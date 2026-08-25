import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useStore, STATUS } from '../store';
import Icon from '../components/Icon';
import { fmtDate, fmtNum, plural } from '../format';
import { C, F, CTRL, cardShadow } from '../theme';

const DOC_TYPES = ['Roadworthy', 'Registration', 'CTP', 'Insurance'];

const LOG_DOT = {
  fault: C.danger, fix: C.green, check: C.primary,
  doc: C.amber, key: C.slate, odo: C.primary,
};

export default function VanScreen() {
  const s = useStore();
  const st = s.state;
  const v = s.vanById(st.vanId) || st.fleet[0];
  // Ephemeral, screen-local UI: the export-format chooser and the remove confirm. Both self-clear
  // when you leave the vehicle, same precedent as the Dashboard finder — no Store field needed.
  const [exportOpen, setExportOpen] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  if (!v) return null;

  const stat = STATUS[s.statOf(v)];
  const hasKeyholder = !!(v.driver && v.driver !== 'Unassigned');
  const log = v.log || [];
  const shown = log.slice(0, st.vanLogOpen ? 200 : 5);
  const lastChecked = v.last == null ? 'never checked' : v.last === 0 ? 'checked today' : 'checked ' + plural(v.last, 'day') + ' ago';

  const primary = v.blocked
    ? { label: "Can't be checked — needs attention", disabled: true }
    : { label: s.hasJobs(v) ? 'Re-check this vehicle' : 'Check this vehicle', disabled: false };

  const onPrimary = () => (primary.disabled
    ? s.say('Clear the flagged document first.')
    : s.startCheck(v.plate));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}>
        {/* Summary — everything that identifies the vehicle and the one action you came to take,
            gathered into a single lead card: rego, model + bay, driver, odo/last-checked, Check. */}
        <View style={styles.summary}>
          <View style={styles.idBlock}>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text style={styles.idPlate} numberOfLines={1}>{v.plate}</Text>
              <View style={styles.idMetaRow}>
                <Text style={styles.idModel} numberOfLines={1}>{v.model}</Text>
                <Text style={styles.idDot}>·</Text>
                <Text style={styles.idBay}>Bay {v.bay}</Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: stat.bg }]}>
              <Text style={[styles.badgeTxt, { color: stat.c }]}>{stat.label}</Text>
            </View>
          </View>

          {v.blocked && (
            <View style={styles.blockBanner}>
              <Text style={styles.blockTxt}>Out of the random pool — {v.blockReason}.</Text>
            </View>
          )}

          <View style={styles.sumStats}>
            <View style={styles.sumStat}>
              <Text style={styles.statCap}>DRIVER</Text>
              <Text numberOfLines={1} style={[styles.statVal, !hasKeyholder && { color: C.muted3 }]}>
                {hasKeyholder ? v.driver : 'Unassigned'}
              </Text>
              <Text style={styles.statFoot}>
                {hasKeyholder && v.driverSince ? 'since ' + fmtDate(v.driverSince) : 'no driver'}
              </Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumStat}>
              <Text style={styles.statCap}>ODOMETER</Text>
              <Text numberOfLines={1} style={styles.statVal}>{v.odo != null && v.odo !== '' ? fmtNum(v.odo) + ' km' : '—'}</Text>
              <Text style={styles.statFoot}>{lastChecked}</Text>
            </View>
          </View>

          <Pressable
            onPress={onPrimary}
            accessibilityRole="button"
            accessibilityState={{ disabled: primary.disabled }}
            style={[styles.primary, primary.disabled && styles.primaryOff]}
          >
            <Text style={[styles.primaryTxt, primary.disabled && styles.primaryTxtOff]}>{primary.label}</Text>
          </Pressable>
        </View>

        {/* Open defects ride near the top when there are any — an inspector shouldn't have to open a
            card to learn the vehicle is carrying outstanding faults. Hidden entirely when clean. */}
        {v.jobs.length > 0 && (
          <View style={styles.defectCard}>
            <View style={styles.defectHead}>
              <Icon name="alert" size={15} color={C.danger} width={2} />
              <Text style={styles.defectTitle}>{plural(v.jobs.length, 'open defect')}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {v.jobs.map((j) => (
                <View key={j} style={styles.jobRow}>
                  <Text style={styles.jobTxt}>{j}</Text>
                  <Pressable onPress={() => s.markFixed(v.plate, j)} accessibilityRole="button" style={styles.fixBtn}>
                    <Icon name="check" size={14} color={C.green} width={2.2} />
                    <Text style={styles.fixTxt}>Mark fixed</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <CollapsibleCard title="Details">
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Year</Text>
            <Text style={styles.detailVal}>{v.year || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Fuel</Text>
            <Text style={styles.detailVal}>{v.fuel || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>In service</Text>
            <Text style={styles.detailVal}>{v.inservice || '—'}</Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowLast]}>
            <Text style={styles.detailKey}>VIN</Text>
            <Text style={styles.detailVin} numberOfLines={1}>{v.vin || '—'}</Text>
          </View>
          <Pressable onPress={() => s.openDetailEdit(v.plate)} accessibilityRole="button" accessibilityLabel="Edit vehicle details" style={styles.cardFootBtn}>
            <Icon name="pen" size={15} color={C.primary} width={1.8} />
            <Text style={styles.cardFootTxt}>Edit details</Text>
          </Pressable>
        </CollapsibleCard>

        <CollapsibleCard title="Documents" meta={plural(v.docs.length, 'doc')}>
          {v.docs.map((d, i) => {
            const dd = typeof d.dueDays === 'number' ? d.dueDays : null;
            const isExp = d.expired || (dd !== null && dd < 0);
            const isSoon = !isExp && d.soon && dd !== null;
            const urgent = isSoon && dd <= 7;
            return (
              <Pressable
                key={d.name + i}
                onPress={() => s.openDocEdit(v.plate, i)}
                accessibilityRole="button"
                accessibilityLabel={'Edit ' + d.name}
                style={styles.docRow}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.docName}>{d.name}</Text>
                  {!!(d.date && String(d.date).trim()) && <Text style={styles.docDate}>{fmtDate(d.date)}</Text>}
                  {!!(d.note && d.note.trim()) && <Text numberOfLines={1} style={styles.docNote}>{d.note}</Text>}
                </View>
                {(isExp || isSoon) && (
                  <View style={[styles.badge, { backgroundColor: isExp ? C.danger : urgent ? C.dangerBg : C.amberBg }]}>
                    <Text style={[styles.badgeTxt, { color: isExp ? '#fff' : urgent ? C.danger : C.amber }]}>
                      {isExp ? 'overdue ' + Math.abs(dd) + 'd' : dd + 'd left'}
                    </Text>
                  </View>
                )}
                <Icon name="chevronRight" size={15} color={C.faint} width={2} />
              </Pressable>
            );
          })}
          <Pressable onPress={() => s.openDocSheet(v.plate)} accessibilityRole="button" style={styles.cardFootBtn}>
            <Icon name="plus" size={16} color={C.primary} width={2} />
            <Text style={styles.cardFootTxt}>Add document</Text>
          </Pressable>
        </CollapsibleCard>

        <CollapsibleCard title="Photo timeline" meta={plural((v.history || []).length, 'check')}>
          {(v.history || []).length === 0 ? (
            <Text style={styles.cardEmpty}>No checks recorded yet.</Text>
          ) : (v.history || []).map((h, hi) => {
            const id = v.plate + hi;
            const open = st.timelineOpen === id;
            const fault = h.result === 'Fault found';
            const label = fault ? 'Defect found' : h.result;
            return (
              <View key={id} style={styles.tlRow}>
                <Pressable onPress={() => s.toggleTimeline(id)} accessibilityRole="button" style={styles.tlHead}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.tlDate}>{h.date}</Text>
                    <Text style={styles.tlBy}>{h.by} · {plural(h.photos || 0, 'photo')}</Text>
                  </View>
                  <Text style={[styles.tlResult, { color: fault ? C.danger : C.green }]}>{label}</Text>
                  <View style={open ? { transform: [{ rotate: '180deg' }] } : null}>
                    <Icon name="chevronDown" size={15} color={C.faint} width={2} />
                  </View>
                </Pressable>
                {open && (
                  <View style={styles.tlGrid}>
                    {Array.from({ length: h.photos || 0 }).map((_, gi) => (
                      <View key={gi} style={styles.tlTile} accessibilityLabel={`Photo ${gi + 1} of ${h.photos}`}>
                        <Icon name="camera" size={16} color={C.faint} width={1.7} />
                      </View>
                    ))}
                    {!h.photos && <Text style={styles.tlNone}>No photos on this check.</Text>}
                  </View>
                )}
              </View>
            );
          })}
        </CollapsibleCard>

        <CollapsibleCard title="Activity log" meta={plural(log.length, 'event') + ' · audit'}>
          {log.length === 0 ? (
            <Text style={styles.cardEmpty}>Nothing logged yet.</Text>
          ) : (
            <>
              {shown.map((e, i) => (
                <View key={i} style={styles.logRow}>
                  <View style={[styles.dot, { backgroundColor: LOG_DOT[e.kind] || C.muted3 }]} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.logWhat}>{e.what}</Text>
                    <Text style={styles.logWhen}>{fmtDate(e.when)} · {e.who}</Text>
                  </View>
                </View>
              ))}
              {log.length > 5 && (
                <Pressable onPress={() => s.toggleVanLog()} accessibilityRole="button" style={styles.logMore}>
                  <Text style={styles.logMoreTxt}>{st.vanLogOpen ? 'Show less' : 'Show all ' + log.length}</Text>
                </Pressable>
              )}
            </>
          )}
        </CollapsibleCard>

        {/* Record-level actions. Export is a placeholder chooser for now; Remove is destructive and
            gated behind an explicit confirm. Both sit apart from the primary Check action above. */}
        <View style={styles.actions}>
          <Pressable onPress={() => setExportOpen(true)} accessibilityRole="button" style={styles.outlineBtn}>
            <Icon name="download" size={16} color={C.ink} width={1.9} />
            <Text style={styles.outlineTxt}>Export vehicle records</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmRemove(true)} accessibilityRole="button" style={styles.dangerBtn}>
            <Icon name="trash" size={16} color={C.danger} width={1.9} />
            <Text style={styles.dangerTxt}>Remove vehicle</Text>
          </Pressable>
        </View>
      </ScrollView>

      {exportOpen && (
        <ExportSheet
          onPick={(fmt) => { setExportOpen(false); s.say('Export coming soon — ' + fmt + ' is on the way.'); }}
          onClose={() => setExportOpen(false)}
        />
      )}
      {confirmRemove && (
        <RemoveSheet
          plate={v.plate}
          model={v.model}
          onConfirm={() => { setConfirmRemove(false); s.removeVan(v.plate); }}
          onClose={() => setConfirmRemove(false)}
        />
      )}
      {st.docSheetOpen && st.docSheetVan === v.plate && <DocSheet plate={v.plate} />}
      {st.detailSheetOpen && st.detailVan === v.plate && <DetailSheet plate={v.plate} />}
    </View>
  );
}

// Default-collapsed disclosure card. Ephemeral local open-state per card, so every section starts
// closed on entry — the summary and any open defects are all that show until you ask for more.
function CollapsibleCard({ title, meta, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={styles.panel}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.collHead, open && styles.collHeadOpen]}
      >
        <Text style={styles.collTitle}>{title}</Text>
        {!!meta && <Text style={styles.collMeta}>{meta}</Text>}
        <View style={open ? { transform: [{ rotate: '180deg' }] } : null}>
          <Icon name="chevronDown" size={16} color={C.faint} width={2} />
        </View>
      </Pressable>
      {open && <View>{children}</View>}
    </View>
  );
}

// Placeholder export chooser — the .xlsx / PDF pipeline isn't wired yet, so each choice just
// acknowledges with a toast. Same bottom-sheet idiom as the doc/detail sheets.
function ExportSheet({ onPick, onClose }) {
  const FORMATS = [
    { fmt: '.xlsx', desc: 'Spreadsheet — checks, defects, documents', icon: 'grid' },
    { fmt: 'PDF', desc: 'Printable summary of this vehicle', icon: 'file' },
  ];
  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Export vehicle records</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>
          {FORMATS.map((f) => (
            <Pressable key={f.fmt} onPress={() => onPick(f.fmt)} accessibilityRole="button" accessibilityLabel={'Export as ' + f.fmt} style={styles.exportRow}>
              <View style={styles.exportIcon}>
                <Icon name={f.icon} size={18} color={C.primary} width={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.exportFmt}>{f.fmt}</Text>
                <Text style={styles.exportDesc} numberOfLines={1}>{f.desc}</Text>
              </View>
              <Icon name="chevronRight" size={15} color={C.faint} width={2} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// Destructive confirm for retiring a vehicle. Deliberately two-step — you can't remove a record
// from a single tap — and the primary action here is the red one, since that's what confirms.
function RemoveSheet({ plate, model, onConfirm, onClose }) {
  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cancel" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Remove vehicle?</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>
        <Text style={styles.removeBody}>
          {model} ({plate}) will be taken off the fleet, along with any pending checks awaiting review.
          Approved history is kept. This can't be undone.
        </Text>
        <Pressable onPress={onConfirm} accessibilityRole="button" style={[styles.sheetSave, { backgroundColor: C.danger }]}>
          <Text style={styles.sheetSaveTxt}>Remove {plate}</Text>
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.removeCancel}>
          <Text style={styles.removeCancelTxt}>Keep vehicle</Text>
        </Pressable>
      </View>
    </View>
  );
}

const FUELS = ['Diesel', 'Petrol', 'Hybrid', 'Electric'];

// Edit the vehicle's master facts. Same bottom-sheet idiom as DocSheet, so the screen keeps one
// editing model. Plate/Bay stay out — the plate keys the vehicle across the store.
function DetailSheet({ plate }) {
  const s = useStore();
  const st = s.state;
  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => s.closeDetailSheet()} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Edit details</Text>
          <Pressable onPress={() => s.closeDetailSheet()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.fieldLabel}>Year</Text>
            <TextInput
              value={st.edYear}
              onChangeText={(x) => s.setDetail({ edYear: x })}
              keyboardType="number-pad"
              placeholder="2020"
              placeholderTextColor={C.muted3}
              accessibilityLabel="Year"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1.6, gap: 7 }}>
            <Text style={styles.fieldLabel}>In service</Text>
            <TextInput
              value={st.edService}
              onChangeText={(x) => s.setDetail({ edService: x })}
              placeholder="Mar 2020"
              placeholderTextColor={C.muted3}
              accessibilityLabel="In service"
              style={styles.input}
            />
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Fuel</Text>
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
            {FUELS.map((f) => {
              const on = st.edFuel === f;
              return (
                <Pressable key={f} onPress={() => s.setDetail({ edFuel: f })} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.typeChip, on && styles.typeChipOn]}>
                  <Text style={[styles.typeChipTxt, on && { color: C.primary }]}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>VIN</Text>
          <TextInput
            value={st.edVin}
            onChangeText={(x) => s.setDetail({ edVin: x })}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="WV1ZZZ…"
            placeholderTextColor={C.muted3}
            accessibilityLabel="VIN"
            style={[styles.input, { fontFamily: F.mono, fontSize: 15 }]}
          />
        </View>

        <Pressable onPress={() => s.saveDetails(plate)} accessibilityRole="button" style={[styles.sheetSave, { backgroundColor: C.primary }]}>
          <Text style={styles.sheetSaveTxt}>Save details</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DocSheet({ plate }) {
  const s = useStore();
  const st = s.state;
  const editing = st.docEditIdx !== null;
  const ready = !!(st.docName || '').trim();

  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => s.closeDocSheet()} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit document' : 'Add document'}</Text>
          <Pressable onPress={() => s.closeDocSheet()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Document</Text>
          <TextInput
            value={st.docName}
            onChangeText={(x) => s.setDoc({ docName: x })}
            placeholder="Roadworthy, rego, insurance…"
            placeholderTextColor={C.muted3}
            accessibilityLabel="Document name"
            style={styles.input}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
          {DOC_TYPES.map((t) => {
            const on = st.docName === t;
            return (
              <Pressable key={t} onPress={() => s.setDoc({ docName: t })} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.typeChip, on && styles.typeChipOn]}>
                <Text style={[styles.typeChipTxt, on && { color: C.primary }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Expiry <Text style={styles.fieldOpt}>· optional</Text></Text>
          <TextInput
            value={st.docDate}
            onChangeText={(x) => s.setDoc({ docDate: x })}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={C.muted3}
            accessibilityLabel="Expiry date"
            style={styles.input}
          />
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Note <Text style={styles.fieldOpt}>· optional</Text></Text>
          <TextInput
            value={st.docNote}
            onChangeText={(x) => s.setDoc({ docNote: x })}
            placeholder="Anything worth recording"
            placeholderTextColor={C.muted3}
            accessibilityLabel="Note"
            multiline
            style={[styles.input, { minHeight: 58, paddingTop: 11, textAlignVertical: 'top' }]}
          />
        </View>

        <Pressable
          onPress={() => s.saveDoc(plate)}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          accessibilityHint={ready ? undefined : 'Name the document first'}
          style={[styles.sheetSave, { backgroundColor: ready ? C.primary : C.disabledBg }]}
        >
          <Text style={[styles.sheetSaveTxt, !ready && { color: C.disabledTxt }]}>{editing ? 'Save changes' : 'Add document'}</Text>
        </Pressable>

        {editing && (
          <Pressable onPress={() => s.removeDoc(plate)} accessibilityRole="button" style={styles.sheetRemove}>
            <Icon name="trash" size={16} color={C.danger} width={1.9} />
            <Text style={styles.sheetRemoveTxt}>Remove document</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 15, gap: 14, ...cardShadow },
  idBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  idPlate: { fontFamily: F.monoBold, fontSize: 23, letterSpacing: 1.5, color: C.ink },
  idMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idModel: { flexShrink: 1, fontFamily: F.sansSemi, fontSize: 14, color: C.muted2 },
  idDot: { fontFamily: F.sans, fontSize: 14, color: C.faint },
  idBay: { fontFamily: F.sansMed, fontSize: 13.5, color: C.muted },
  badge: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  badgeTxt: { fontFamily: F.monoBold, fontSize: 10 },

  sumStats: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: C.hair, paddingTop: 13 },
  sumStat: { flex: 1, minWidth: 0, gap: 4 },
  sumDivider: { width: 1, backgroundColor: C.hair, marginHorizontal: 14 },
  statCap: { fontFamily: F.sansSemi, fontSize: 11, letterSpacing: 0.5, color: C.muted },
  statVal: { fontFamily: F.sansSemi, fontSize: 15, color: C.ink },
  statFoot: { fontFamily: F.mono, fontSize: 11.5, color: C.muted3 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.hair, minHeight: 46 },
  detailRowLast: { borderBottomWidth: 0 },
  detailKey: { fontFamily: F.sansMed, fontSize: 14, color: C.muted, width: 92 },
  detailVal: { flex: 1, minWidth: 0, fontFamily: F.sansSemi, fontSize: 14, color: C.ink, textAlign: 'right' },
  detailVin: { flex: 1, minWidth: 0, fontFamily: F.mono, fontSize: 12.5, color: C.ink, textAlign: 'right' },

  blockBanner: { borderWidth: 1.5, borderColor: C.danger, backgroundColor: C.dangerBg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 13 },
  blockTxt: { fontFamily: F.sansMed, fontSize: 13, lineHeight: 19, color: C.danger },

  primary: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  primaryOff: { backgroundColor: C.disabledBg },
  primaryTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
  primaryTxtOff: { color: C.disabledTxt },

  panel: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden', ...cardShadow },
  collHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: CTRL.md },
  collHeadOpen: { borderBottomWidth: 1, borderBottomColor: C.hair },
  collTitle: { flex: 1, minWidth: 0, fontFamily: F.sansSemi, fontSize: 14, color: C.ink },
  collMeta: { fontFamily: F.monoMed, fontSize: 11.5, color: C.muted3 },
  cardFootBtn: { backgroundColor: C.cardSubtle, paddingVertical: 12, paddingHorizontal: 14, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cardFootTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.primary },
  cardEmpty: { fontFamily: F.sans, fontSize: 13.5, color: C.muted, paddingVertical: 14, paddingHorizontal: 14 },

  docRow: { borderBottomWidth: 1, borderBottomColor: C.hair, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  docName: { fontFamily: F.sansMed, fontSize: 14, color: C.ink },
  docDate: { fontFamily: F.mono, fontSize: 12, color: C.muted },
  docNote: { fontFamily: F.sans, fontSize: 12, color: C.muted },

  tlRow: { borderBottomWidth: 1, borderBottomColor: C.hair },
  tlHead: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tlDate: { fontFamily: F.sansSemi, fontSize: 14.5, color: C.ink },
  tlBy: { fontFamily: F.sans, fontSize: 12, color: C.muted },
  tlResult: { fontFamily: F.monoBold, fontSize: 10 },
  tlGrid: { borderTopWidth: 1, borderTopColor: C.hair, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tlTile: { width: '23%', aspectRatio: 1, borderRadius: 8, backgroundColor: C.border2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  tlNone: { fontFamily: F.sans, fontSize: 13, color: C.muted },

  defectCard: { borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.dangerBg2, borderRadius: 16, padding: 13, gap: 10 },
  defectHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  defectTitle: { fontFamily: F.sansSemi, fontSize: 13, color: C.danger },
  jobRow: { borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.card, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobTxt: { flex: 1, minWidth: 0, fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink },
  fixBtn: { minHeight: CTRL.sm, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.greenBorder, backgroundColor: C.greenBg },
  fixTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.green },

  logRow: { flexDirection: 'row', gap: 11, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  dot: { marginTop: 5, width: 9, height: 9, borderRadius: 999 },
  logWhat: { fontFamily: F.sansMed, fontSize: 14, lineHeight: 19, color: C.ink },
  logWhen: { fontFamily: F.mono, fontSize: 11.5, color: C.muted },
  logMore: { paddingTop: 11, paddingBottom: 9, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  logMoreTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.primary },

  actions: { gap: 10, paddingTop: 4 },
  outlineBtn: { minHeight: CTRL.md, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...cardShadow },
  outlineTxt: { fontFamily: F.sansSemi, fontSize: 15, color: C.ink },
  dangerBtn: { minHeight: CTRL.md, borderRadius: 14, borderWidth: 1, borderColor: C.dangerBorder, backgroundColor: C.dangerBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dangerTxt: { fontFamily: F.sansSemi, fontSize: 15, color: C.danger },

  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 13, minHeight: CTRL.lg, backgroundColor: C.card },
  exportIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chipBlue },
  exportFmt: { fontFamily: F.sansSemi, fontSize: 15, color: C.ink },
  exportDesc: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },
  removeBody: { fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted2 },
  removeCancel: { minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  removeCancelTxt: { fontFamily: F.sansSemi, fontSize: 14, color: C.muted2 },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,33,38,0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 26, gap: 16 },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 999, backgroundColor: C.border3, marginTop: 6, marginBottom: 2 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetTitle: { fontFamily: F.sansBold, fontSize: 19, color: C.ink },
  sheetX: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.hair },
  fieldLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted2 },
  fieldOpt: { fontFamily: F.sans, color: C.muted3 },
  input: { minHeight: 50, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 14, fontFamily: F.sansMed, fontSize: 16, color: C.ink, backgroundColor: C.inputBg },
  typeChip: { minHeight: CTRL.sm, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.border3, backgroundColor: C.card },
  typeChipOn: { borderColor: C.primary, backgroundColor: C.chipBlue },
  typeChipTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.muted2 },
  sheetSave: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetSaveTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
  sheetRemove: { minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  sheetRemoveTxt: { fontFamily: F.sansSemi, fontSize: 14, color: C.danger },
});
