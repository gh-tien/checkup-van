import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, Image, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { PEOPLE, initials } from '../data/model';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';

const SEVERITIES = ['Minor', 'Major', 'Critical'];
const SEV_COLOR = { Minor: { fg: C.amber, bg: C.amberBg }, Major: { fg: C.danger, bg: C.dangerBg }, Critical: { fg: '#fff', bg: C.danger } };

export default function CheckScreen() {
  const s = useStore();
  const st = s.state;
  const plate = st.checkVan;
  const step = st.checkStep;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.rego}>{plate}</Text>
        {step === 'driver' && <DriverStep />}
        {step === 'photos' && <PhotosStep />}
        {step === 'list' && <ListStep />}
        {step === 'review' && <ReviewStep />}
        {step === 'done' && <DoneStep />}
      </ScrollView>
      {/* The sheet steps aside while the camera is up, rather than stacking two modals. */}
      {st.failSheet && !st.camera && <FailSheet />}
    </View>
  );
}

function DriverStep() {
  const s = useStore();
  const st = s.state;
  const plate = st.checkVan;
  const v = st.fleet.find((x) => x.plate === plate);
  const onFile = v && v.driver && v.driver !== 'Unassigned' ? v.driver : null;

  const noDriver = st.checkNoKeyholder;
  const typed = (st.checkDriver || '').trim();
  // The card always shows a name: the no-driver state, whoever's typed in, or the on-file driver.
  const shownName = noDriver ? 'No driver' : (typed || onFile || 'Not on file');
  const changed = !noDriver && !!typed && typed !== onFile;
  // Confirm acts on the name the card shows — a typed driver, or the on-file one when the field is empty.
  const canConfirm = noDriver || !!typed || !!onFile;
  const meta = noDriver ? 'Spare / yard vehicle'
    : changed ? 'Different driver'
    : onFile ? 'Driver on file'
    : 'No driver on file yet';

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.stepLabel}>Before you start · Confirm driver</Text>

      {/* Who has the vehicle — name stays put; Confirm sits right beside it for the one-tap path. */}
      <View style={styles.driverCard}>
        <View style={[styles.driverAv, noDriver && styles.driverAvMuted]}>
          {noDriver
            ? <Icon name="truck" size={20} color={C.muted2} width={1.7} />
            : <Text style={styles.driverAvTxt}>{initials(shownName)}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.driverName} numberOfLines={1}>{shownName}</Text>
          <Text style={styles.driverMeta} numberOfLines={1}>{meta}</Text>
        </View>
        <Pressable
          onPress={() => s.confirmDriverStart()}
          disabled={!canConfirm}
          style={[styles.confirmBtn, !canConfirm && styles.primaryBtnOff]}
          accessibilityRole="button"
          accessibilityLabel={`Confirm ${shownName} and start the walk-around`}
        >
          <Text style={[styles.confirmBtnTxt, !canConfirm && styles.primaryBtnTextOff]}>Confirm</Text>
        </Pressable>
      </View>

      {/* Someone else has it? A separate field — editing here never hides the name above. */}
      <View style={{ gap: 8, opacity: noDriver ? 0.4 : 1 }}>
        <Text style={styles.driverFieldLabel}>Someone else driving it?</Text>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 13, zIndex: 1 }}><Icon name="search" size={18} color={C.muted3} width={1.7} /></View>
          <TextInput
            value={st.checkDriver}
            editable={!noDriver}
            onChangeText={(t) => s.onChkDriver(t)}
            onFocus={() => { if ((st.checkDriver || '').length) s.onChkDriver(''); }}
            placeholder="Search a different driver"
            placeholderTextColor={C.muted3}
            style={[styles.input, { paddingLeft: 40, paddingRight: !noDriver && typed ? 40 : 13 }]}
          />
          {!noDriver && typed ? (
            <Pressable
              onPress={() => s.onChkDriver(onFile || '')}
              hitSlop={8}
              style={{ position: 'absolute', right: 11, zIndex: 1 }}
              accessibilityRole="button"
              accessibilityLabel={onFile ? `Clear — reset to ${onFile}` : 'Clear driver'}
            >
              <Icon name="x" size={16} color={C.muted3} width={2} />
            </Pressable>
          ) : null}
        </View>
        {changed && onFile ? (
          <Pressable onPress={() => s.onChkDriver(onFile)} accessibilityRole="button" style={styles.resetChip}>
            <Icon name="refresh" size={13} color={C.primary} width={1.8} />
            <Text style={styles.resetChipTxt}>Reset to {onFile}</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => s.toggleNoKeyholder()}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: noDriver }}
        accessibilityLabel="Vehicle not in use, spare"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: CTRL.sm }}
      >
        <View style={[styles.checkbox, noDriver && { backgroundColor: C.primary, borderColor: C.primary }]}>
          {noDriver && <Icon name="check" size={14} color="#fff" width={3} />}
        </View>
        <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.ink }}>Vehicle not in use (spare)</Text>
      </Pressable>
    </View>
  );
}

function PhotosStep() {
  const s = useStore();
  const st = s.state;
  const angles = st.photoAngles;
  const taken = angles.filter((a) => s.photosFor(a).length > 0).length;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={styles.stepLabel}>Step 1 of 3 · Photos</Text>
        <Text style={{ fontFamily: F.monoSemi, fontSize: 12, color: taken === angles.length ? C.green : C.muted }}>{taken}/{angles.length}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {angles.map((a) => {
          const shots = s.photosFor(a);
          const done = shots.length > 0;
          return (
            <View key={a} style={{ width: '48.5%' }}>
              <Pressable
                onPress={() => s.capturePhoto(a)}
                style={[styles.tile, done && styles.tileDone]}
                accessibilityRole="button"
                accessibilityLabel={done ? `${a}, ${shots.length} photo${shots.length === 1 ? '' : 's'} taken, tap to add another` : `${a}, not taken, tap to capture`}
              >
                {done ? (
                  <>
                    {/* Newest frame is the one the inspector just approved. */}
                    <Image source={{ uri: shots[shots.length - 1] }} style={styles.thumb} resizeMode="cover" />
                    <View style={styles.thumbBar}>
                      <Text numberOfLines={1} style={styles.thumbLabel}>{a}</Text>
                      <Text style={styles.thumbMeta}>{shots.length} · retake</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Icon name="camera" size={22} color={C.muted3} width={1.7} />
                    <Text style={{ fontFamily: F.sansSemi, fontSize: 12.5, color: C.ink, textAlign: 'center', paddingHorizontal: 6 }}>{a}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted3 }}>not taken</Text>
                  </>
                )}
              </Pressable>
              {done && (
                <Pressable onPress={() => s.clearPhoto(a)} style={styles.tileClear} accessibilityRole="button" accessibilityLabel={`Discard ${a} photos`}>
                  <Icon name="x" size={13} color="#fff" width={2.2} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <Pressable onPress={() => s.chkToList()} style={[styles.primaryBtn, { marginTop: 4 }]} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>Next: checklist</Text>
      </Pressable>
    </View>
  );
}

function ListStep() {
  const s = useStore();
  const st = s.state;
  const model = s.clModel();
  const items = model.flatMap((sec) => sec.items);
  const done = items.filter((it) => st.checkResults[it.id]).length;

  return (
    <View style={{ gap: 11 }}>
      {/* Pass-everything is a development affordance only — an accidental hold on a real
          checklist would silently falsify an inspection, so it never reaches a depot phone. */}
      <Pressable
        onLongPress={__DEV__ ? () => s.setState({ checkResults: Object.fromEntries(items.map((it) => [it.id, 'pass'])), checkDefects: {} }, () => s.say('All items set to Pass (dev shortcut).')) : undefined}
        delayLongPress={600}
      >
        <Text style={styles.stepLabel}>Step 2 of 3 · Checklist · {done}/{items.length}</Text>
      </Pressable>
      {items.map((it) => {
        const r = st.checkResults[it.id];
        const failed = r === 'fail';
        const def = st.checkDefects[it.id];
        return (
          <View key={it.id} style={[styles.itemCard]}>
            <View style={{ gap: 9 }}>
              <View style={{ minWidth: 0 }}>
                <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.ink }}>{it.text}</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.muted3 }}>{it.section}</Text>
              </View>
              <View style={styles.pfPair}>
                <Pressable
                  onPress={() => s.passItem(it.id)}
                  style={[styles.pfBtn, r === 'pass' ? { backgroundColor: C.green, borderColor: C.green } : {}]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: r === 'pass' }}
                  accessibilityLabel={`Pass — ${it.text}`}
                >
                  <Text style={{ fontFamily: F.sansSemi, fontSize: 14, color: r === 'pass' ? '#fff' : C.muted2 }}>Pass</Text>
                </Pressable>
                <Pressable
                  onPress={() => s.openFailSheet(it)}
                  style={[styles.pfBtn, failed ? { backgroundColor: C.danger, borderColor: C.danger } : {}]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: failed }}
                  accessibilityLabel={`Fail — ${it.text}. Opens the defect form.`}
                >
                  <Text style={{ fontFamily: F.sansSemi, fontSize: 14, color: failed ? '#fff' : C.muted2 }}>Fail</Text>
                </Pressable>
              </View>
            </View>
            {failed && (
              <Pressable onPress={() => s.openFailSheet(it)} style={styles.failNote} accessibilityRole="button" accessibilityLabel={`Edit the defect on ${it.text}`}>
                <Icon name="alert" size={15} color={C.danger} width={1.9} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.sansMed, fontSize: 12, color: C.danger }}>{def ? def.desc : 'Defect'}</Text>
                <Text style={{ fontFamily: F.sansSemi, fontSize: 11, color: C.danger }}>Edit</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <Pressable onPress={() => s.chkToReview()} style={[styles.primaryBtn, { marginTop: 4 }]} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>Next: review</Text>
      </Pressable>
    </View>
  );
}

function ReviewStep() {
  const s = useStore();
  const st = s.state;
  const model = s.clModel();
  const items = model.flatMap((sec) => sec.items);
  const pass = items.filter((it) => st.checkResults[it.id] === 'pass').length;
  const fail = items.filter((it) => st.checkResults[it.id] === 'fail').length;
  const photos = s.photoCount();
  const defects = items.filter((it) => st.checkResults[it.id] === 'fail').map((it) => ({ it, def: st.checkDefects[it.id] }));
  const signer = s.resolvedPerson();
  const signerIni = (st.people.find((x) => x.name === signer) || {}).ini || initials(signer);
  const odoOk = /\d/.test(st.checkOdo || '');

  const verdict = fail > 0
    ? { label: 'Defects found', sub: `${fail} item${fail === 1 ? '' : 's'} failed — logged as defects`, color: C.danger, bg: C.dangerBg2, border: C.dangerBorder }
    : { label: 'All clear', sub: 'No defects on this walk-around', color: C.green, bg: C.greenBg2, border: C.greenBorderSoft };

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.stepLabel}>Step 3 of 3 · Review & signature</Text>

      <View style={{ borderWidth: 1.5, borderColor: verdict.border, backgroundColor: verdict.bg, borderRadius: 16, padding: 15, gap: 3 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 19, color: verdict.color }}>{verdict.label}</Text>
        <Text style={{ fontFamily: F.sansMed, fontSize: 13, color: C.muted2 }}>{verdict.sub}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tally n={pass} label="Passed" color={C.green} />
        <Tally n={fail} label="Failed" color={C.danger} />
        <Tally n={`${photos}`} label="Photos" color={C.primary} />
      </View>

      {defects.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.miniLabel}>Defects you're reporting</Text>
          {defects.map(({ it, def }) => {
            const sev = SEV_COLOR[(def && def.severity) || 'Minor'];
            return (
              <View key={it.id} style={styles.defectRow}>
                <Text style={[styles.sevPill, { color: sev.fg, backgroundColor: sev.bg }]}>{(def && def.severity) || 'Minor'}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.ink }}>{def ? def.desc : it.text}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 11.5, color: C.muted3 }}>{it.section}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {def && def.due ? <Text style={{ fontFamily: F.sansMed, fontSize: 11, color: C.amber }}>Due {def.due}</Text> : null}
                    {def && def.photos && def.photos.length ? <Text style={{ fontFamily: F.sansMed, fontSize: 11, color: C.primary }}>{def.photos.length} photo{def.photos.length === 1 ? '' : 's'}</Text> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={styles.miniLabel}>Confirm driver</Text>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 13, zIndex: 1 }}><Icon name="user" size={18} color={C.muted3} width={1.7} /></View>
          <TextInput value={st.checkDriver} onChangeText={(t) => s.onChkDriver(t)} placeholder="Who has the vehicle — name, or leave blank" placeholderTextColor={C.muted3} style={[styles.input, { paddingLeft: 40 }]} />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.miniLabel}>Odometer reading (km)</Text>
        <TextInput value={st.checkOdo} onChangeText={(t) => s.onChkOdo(t)} keyboardType="numeric" placeholder="e.g. 84210" placeholderTextColor={C.muted3} style={styles.input} />
      </View>

      <View style={{ borderWidth: 1.5, borderColor: st.checkSigned ? C.green : C.border, borderRadius: 16, padding: 14, gap: 12, backgroundColor: st.checkSigned ? C.greenTint : C.card }}>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 20, color: C.muted2 }}>
          I confirm this walk-around was carried out on {st.checkVan} and the record above is accurate.
        </Text>
        {!st.checkSigned ? (
          odoOk ? (
            <Pressable onPress={() => s.signCheck()} style={styles.signBtn} accessibilityRole="button" accessibilityLabel={`Sign this declaration as ${signer}`}>
              <Icon name="pen" size={19} color={C.primary} width={1.8} />
              <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: C.primary }}>Tap to sign as {signer}</Text>
            </Pressable>
          ) : (
            <View style={styles.needOdo}>
              <Icon name="info" size={17} color={C.muted2} width={1.8} />
              <Text style={{ fontFamily: F.sansSemi, fontSize: 14, color: C.muted2, textAlign: 'center' }}>Record the odometer to sign</Text>
            </View>
          )
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
            <View style={styles.signAvatar}><Text style={{ fontFamily: F.sansBold, fontSize: 15, color: '#fff' }}>{signerIni}</Text></View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ fontFamily: F.sans, fontSize: 22, fontStyle: 'italic', color: C.ink }}>{signer}</Text>
              <Text style={{ fontFamily: F.monoMed, fontSize: 11, color: C.green }}>Signed · 24 Aug 2026</Text>
            </View>
            <Pressable onPress={() => s.signCheck()} style={styles.clearSign} accessibilityRole="button" accessibilityLabel="Clear this signature"><Text style={{ fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted }}>Clear</Text></Pressable>
          </View>
        )}
      </View>

      {/* Not-ready uses the shared disabled pair, but the press still lands and submitCheck()
          says what is missing — the same bargain ResetModal makes. */}
      <Pressable
        onPress={() => s.submitCheck()}
        style={[styles.primaryBtn, !st.checkSigned && styles.primaryBtnOff]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !st.checkSigned }}
        accessibilityHint={st.checkSigned ? undefined : 'Sign the declaration first'}
      >
        <Text style={[styles.primaryBtnText, !st.checkSigned && styles.primaryBtnTextOff]}>Submit for approval</Text>
      </Pressable>
    </View>
  );
}

function DoneStep() {
  const s = useStore();
  const st = s.state;
  const model = s.clModel();
  const items = model.flatMap((sec) => sec.items);
  const fail = items.filter((it) => st.checkResults[it.id] === 'fail').length;
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 24 }}>
      <View style={styles.doneCircle}><Icon name="check" size={28} color={C.green} width={2.4} /></View>
      <Text style={{ fontFamily: F.sansBold, fontSize: 19, color: C.ink }}>Check submitted</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted, textAlign: 'center' }}>{st.checkVan} logged · {fail} fault(s) raised.</Text>
      <Pressable onPress={() => s.finishCheck()} style={[styles.primaryBtn, { paddingHorizontal: 22, alignSelf: 'center' }]} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>Back to van record</Text>
      </Pressable>
    </View>
  );
}

function FailSheet() {
  const s = useStore();
  const fs = s.state.failSheet;
  const ready = !!(fs.desc || '').trim();
  return (
    <Modal transparent animationType="slide" onRequestClose={() => s.cancelFail()}>
      <Pressable onPress={() => s.cancelFail()} style={styles.sheetBackdrop} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 3, flex: 1 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 17, color: C.danger }}>Record a defect</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>{fs.text}</Text>
            </View>
            <Pressable onPress={() => s.cancelFail()} style={styles.sheetX} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close without recording a defect">
              <Icon name="x" size={16} color={C.muted2} width={2.2} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.miniLabel}>What is wrong</Text>
            <TextInput value={fs.desc} onChangeText={(t) => s.failSet({ desc: t })} placeholder="Describe the fault" placeholderTextColor={C.muted3} multiline style={[styles.input, { minHeight: 62, paddingTop: 10, textAlignVertical: 'top' }]} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.miniLabel}>Severity</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SEVERITIES.map((sev) => {
                const on = fs.severity === sev;
                const col = SEV_COLOR[sev];
                return (
                  <Pressable
                    key={sev}
                    onPress={() => s.failSet({ severity: sev })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Severity ${sev}`}
                    style={[styles.sevChip, on ? { backgroundColor: col.bg, borderColor: col.fg } : {}]}
                  >
                    <Text style={{ fontFamily: F.sansSemi, fontSize: 13, color: on ? col.fg : C.muted2 }}>{sev}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.miniLabel}>Due date (optional)</Text>
            <TextInput value={fs.due} onChangeText={(t) => s.failSet({ due: t })} placeholder="e.g. 30 Aug 2026" placeholderTextColor={C.muted3} style={styles.input} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.miniLabel}>Photos</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pressable onPress={() => s.captureDefectPhoto()} style={styles.photoBtn} accessibilityRole="button" accessibilityLabel="Take a photo of this defect">
                <Icon name="camera" size={19} color={C.danger} width={1.7} />
                <Text style={{ fontFamily: F.sansSemi, fontSize: 13.5, color: C.danger }}>Take photo</Text>
              </Pressable>
              {(fs.photos || []).map((uri) => (
                <View key={uri}>
                  <Image source={{ uri }} style={styles.defectThumb} resizeMode="cover" />
                  <Pressable
                    onPress={() => s.removeFailPhoto(uri)}
                    style={styles.defectThumbX}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this defect photo"
                  >
                    <Icon name="x" size={11} color="#fff" width={2.4} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => s.saveFail()}
            style={[styles.primaryBtn, { marginTop: 2 }, ready ? styles.primaryBtnDanger : styles.primaryBtnOff]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            accessibilityHint={ready ? undefined : 'Describe what is wrong first'}
          >
            <Text style={[styles.primaryBtnText, !ready && styles.primaryBtnTextOff]}>Save defect & fail item</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Tally = ({ n, label, color }) => (
  <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
    <Text style={{ fontFamily: F.sansBold, fontSize: 22, color }}>{n}</Text>
    <Text style={{ fontFamily: F.sansMed, fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  // Vehicle identity — the plate leads the wizard header on every step. Mono, like the plate on the draw + fleet.
  rego: { fontFamily: F.monoBold, fontSize: 21, letterSpacing: 1.4, color: C.ink },
  stepLabel: { fontFamily: F.sansSemi, fontSize: 13, letterSpacing: 0.1, color: C.muted2 },
  miniLabel: { fontFamily: F.sansSemi, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: C.muted },
  driverFieldLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted },
  input: { borderWidth: 1, borderColor: C.border3, borderRadius: 12, minHeight: CTRL.md, paddingHorizontal: 13, fontFamily: F.sansMed, fontSize: 15, color: C.ink, backgroundColor: C.card },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.6, borderColor: C.border3, alignItems: 'center', justifyContent: 'center' },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingVertical: 12, paddingLeft: 12, paddingRight: 12, ...cardShadow,
  },
  driverAv: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  driverAvMuted: { backgroundColor: C.chipBlue },
  driverAvTxt: { fontFamily: F.sansBold, fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  driverName: { fontFamily: F.sansBold, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
  driverMeta: { fontFamily: F.sansMed, fontSize: 12, color: C.muted, marginTop: 2 },
  confirmBtn: { minHeight: CTRL.md, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnTxt: { fontFamily: F.sansSemi, fontSize: 15, color: '#fff' },
  resetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: CTRL.sm, paddingRight: 6 },
  resetChipTxt: { fontFamily: F.sansMed, fontSize: 13, color: C.primary },
  primaryBtn: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  primaryBtnDanger: { backgroundColor: C.danger },
  primaryBtnOff: { backgroundColor: C.disabledBg },
  primaryBtnText: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
  primaryBtnTextOff: { color: C.disabledTxt },
  tile: { minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: C.border3, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, paddingVertical: 10 },
  tileDone: { borderColor: C.primary, borderStyle: 'solid', backgroundColor: C.tintBlue, overflow: 'hidden', paddingVertical: 0 },
  thumb: { ...StyleSheet.absoluteFillObject },
  thumbBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 7, paddingHorizontal: 9, gap: 1, backgroundColor: 'rgba(27,33,38,.62)' },
  thumbLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: '#fff' },
  thumbMeta: { fontFamily: F.mono, fontSize: 10.5, color: 'rgba(255,255,255,.8)' },
  defectThumb: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  defectThumbX: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 999, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  tileClear: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 999, backgroundColor: 'rgba(27,33,38,.55)', alignItems: 'center', justifyContent: 'center' },
  itemCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, gap: 7 },
  // The most-repeated control in the app, pressed outdoors and often gloved: full row width at CTRL.md.
  pfPair: { flexDirection: 'row', gap: 8 },
  pfBtn: { flex: 1, minHeight: CTRL.md, borderRadius: 10, borderWidth: 1, borderColor: C.border3, alignItems: 'center', justifyContent: 'center' },
  failNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerBg, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10 },
  defectRow: { flexDirection: 'row', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.dangerBorder, borderRadius: 12, padding: 11 },
  sevPill: { fontFamily: F.monoBold, fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 6, overflow: 'hidden', alignSelf: 'flex-start' },
  signBtn: { minHeight: CTRL.lg, borderRadius: 13, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', backgroundColor: C.tintBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  needOdo: { minHeight: CTRL.lg, borderRadius: 13, borderWidth: 1.5, borderColor: C.borderMuted, borderStyle: 'dashed', backgroundColor: C.inputBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  signAvatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  clearSign: { minHeight: CTRL.sm, paddingHorizontal: 10, justifyContent: 'center' },
  sheetX: { width: CTRL.sm, height: CTRL.sm, alignItems: 'center', justifyContent: 'center' },
  doneCircle: { width: 56, height: 56, borderRadius: 999, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(27,33,38,.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30, gap: 13 },
  photoBtn: { minHeight: CTRL.md, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: C.danger, borderStyle: 'dashed', backgroundColor: C.dangerBg2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevChip: { flex: 1, minHeight: CTRL.sm, borderRadius: 10, borderWidth: 1, borderColor: C.border3, alignItems: 'center', justifyContent: 'center' },
});
