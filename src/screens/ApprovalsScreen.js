import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Image, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { fmtDate, fmtNum, plural } from '../format';
import { C, F, CTRL, cardShadow } from '../theme';

export default function ApprovalsScreen() {
  const s = useStore();
  const st = s.state;
  const me = s.resolvedPerson();
  const mgr = s.isManager();

  const inPeriod = st.approved.filter((a) => (st.approvedPeriod === 'week' ? a.week : true));
  const periodLabel = st.approvedPeriod === 'week' ? 'this week' : 'this month';
  const returned = mgr ? st.returned : st.returned.filter((r) => r.by === me);
  // An inspector cannot sign anything, so the queue is scoped to their own pending submissions —
  // a manager sees the whole board.
  const visibleQueue = mgr ? st.queue : st.queue.filter((q) => q.by === me);

  const sub = mgr
    ? st.queue.length + ' awaiting · ' + inPeriod.length + ' signed ' + periodLabel
    : (visibleQueue.length ? visibleQueue.length + ' of yours awaiting · ' : '') + inPeriod.length + ' approved ' + periodLabel;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <Text style={styles.sub}>{sub}</Text>

        {returned.length > 0 && (
          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionLabel, { color: C.danger }]}>Returned — needs redo</Text>
            {returned.map((r) => (
              <View key={r.id} style={styles.returnedCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.plate}>{r.plate}</Text>
                  <Text style={[styles.tag, { color: C.danger }]}>redo</Text>
                </View>
                <Text style={styles.reason}>“{r.reason || ''}”</Text>
                <Text style={styles.metaMono}>
                  Returned {fmtDate(r.returnedDate || '')} · by {r.returnedBy || 'a manager'}
                </Text>
                {r.by === me && (
                  <Pressable onPress={() => s.redoReturned(r.id)} accessibilityRole="button" style={styles.redoBtn}>
                    <Text style={styles.redoTxt}>Redo this walk</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {visibleQueue.length > 0 ? (
          <View style={{ gap: 9 }}>
            <Text style={[styles.sectionLabel, { color: C.amber }]}>{mgr ? 'Awaiting approval' : 'Your submissions awaiting approval'} · {visibleQueue.length}</Text>
            {visibleQueue.map((q) => <QueueCard key={q.id} q={q} me={me} mgr={mgr} />)}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              {mgr
                ? 'Nothing awaiting approval.'
                : 'Nothing awaiting approval.'}
            </Text>
          </View>
        )}

        <View style={styles.periodRow}>
          <Text style={styles.sectionLabel}>Approved · {periodLabel}</Text>
          <View style={styles.segment}>
            {[['week', 'Week'], ['month', 'Month']].map(([key, label]) => {
              const on = st.approvedPeriod === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => s.setApprovedPeriod(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.segBtn, on && styles.segBtnOn]}
                >
                  <Text style={[styles.segTxt, on && styles.segTxtOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {inPeriod.map((a) => (
          <Pressable key={a.id} onPress={() => s.openRecord(a.plate)} accessibilityRole="button" style={styles.approvedRow}>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={styles.cardTop}>
                <Text style={styles.plate}>{a.plate}</Text>
                <Text style={[styles.tag, { color: C.primary }]}>Signed ✓</Text>
              </View>
              <Text style={[styles.meta, { color: a.defects ? C.danger : C.muted }]}>
                {fmtDate(a.date)} · {a.by} · {a.defects ? plural(a.defects, 'defect') : 'clean'} · signed {a.signedBy}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={C.faint} width={2} />
          </Pressable>
        ))}
        {inPeriod.length === 0 && <Text style={styles.emptyTxt}>No approved full inspections {periodLabel}.</Text>}
      </ScrollView>

      {!!st.sendBackFor && <SendBackSheet />}
    </View>
  );
}

function QueueCard({ q, me, mgr }) {
  const s = useStore();
  const st = s.state;
  const own = q.by === me;
  const canSign = mgr && !own;
  const sub = q.submission || {};
  const fails = sub.failedItems || (q.note ? [q.note] : []);
  const open = st.queueSubOpen === q.id;
  const fault = q.result === 'Fault found';

  return (
    <View style={styles.queueCard}>
      <View style={styles.cardTop}>
        <Text style={styles.plateLg}>{q.plate}</Text>
        <Text style={[styles.tag, { color: fault ? C.danger : C.green }]}>
          {fault ? plural(q.defects, 'defect') : 'Clean'}
        </Text>
      </View>
      <Text style={styles.meta}>{fmtDate(q.date)} · {q.by}</Text>
      {!!q.note && <Text style={[styles.meta, { color: C.danger }]}>{q.note}</Text>}

      <Pressable onPress={() => s.toggleQueueSub(q.id)} accessibilityRole="button" style={styles.subToggle}>
        <Text style={styles.subToggleTxt}>{open ? 'Hide submission' : 'View submission'}</Text>
        <View style={open ? { transform: [{ rotate: '180deg' }] } : null}>
          <Icon name="chevronDown" size={15} color={C.primary} width={2} />
        </View>
      </Pressable>

      {open && (
        <View style={styles.subPanel}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SubStat cap="Odometer" val={sub.odo != null ? fmtNum(sub.odo) + ' km' : '—'} />
            <SubStat cap="Photos" val={sub.photos != null ? String(sub.photos) : '—'} />
            <SubStat cap="Items" val={sub.passed != null ? sub.passed + ' passed · ' + fails.length + ' failed' : q.defects + ' failed'} />
          </View>
          <View>
            <Text style={styles.subCap}>DRIVER</Text>
            <Text style={styles.subVal}>{sub.keyholder || '—'}</Text>
          </View>

          {(sub.angles || []).length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.subCap}>PHOTOS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                {sub.angles.map((a) => {
                  // Checks submitted with the camera carry a frame; seeded ones only carry the angle name.
                  const uri = ((sub.shots || []).find((x) => x.angle === a) || {}).uri;
                  return (
                    <View key={a} style={styles.photoTile}>
                      {uri
                        ? <Image source={{ uri }} style={styles.photoTileImg} resizeMode="cover" />
                        : <Text numberOfLines={2} style={styles.photoTileTxt}>{a}</Text>}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {fails.length > 0 ? (
            <View style={{ gap: 5 }}>
              <Text style={[styles.subCap, { color: C.danger }]}>DEFECTS RAISED</Text>
              {fails.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}>
                  <View style={styles.failDot} />
                  <Text style={styles.failTxt}>{t}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.cleanTxt}>All items passed — no defects.</Text>
          )}

          <Text style={styles.signedBy}>Signed by {sub.signedBy || q.by}</Text>
        </View>
      )}

      {canSign && (
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Pressable onPress={() => s.approveCheck(q.id)} accessibilityRole="button" style={styles.approveBtn}>
            <Icon name="check" size={16} color="#fff" width={2.2} />
            <Text style={styles.approveTxt}>Countersign</Text>
          </Pressable>
          <Pressable onPress={() => s.openSendBack(q.id)} accessibilityRole="button" style={styles.sendBackBtn}>
            <Text style={styles.sendBackTxt}>Send back</Text>
          </Pressable>
        </View>
      )}
      {mgr && own && <Text style={styles.note}>Another manager signs this off</Text>}
      {!mgr && <Text style={styles.note}>Awaiting manager approval</Text>}
    </View>
  );
}

function SubStat({ cap, val }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.subCap}>{cap.toUpperCase()}</Text>
      <Text style={[styles.subVal, { marginTop: 3 }]}>{val}</Text>
    </View>
  );
}

function SendBackSheet() {
  const s = useStore();
  const st = s.state;
  const item = st.queue.find((q) => q.id === st.sendBackFor) || {};
  const ready = !!(st.sendBackNote || '').trim();

  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => s.closeSendBack()} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Send back {item.plate || ''}</Text>
          <Pressable onPress={() => s.closeSendBack()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={16} color={C.muted2} width={2.2} />
          </Pressable>
        </View>
        <TextInput
          value={st.sendBackNote}
          onChangeText={(v) => s.onSendBackNote(v)}
          placeholder="What needs redoing?"
          placeholderTextColor={C.muted3}
          accessibilityLabel="Reason"
          multiline
          style={styles.sheetInput}
        />
        <Pressable
          onPress={() => s.confirmSendBack()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          accessibilityHint={ready ? undefined : 'Add a reason first'}
          style={[styles.sheetConfirm, { backgroundColor: ready ? C.danger : C.disabledBg }]}
        >
          <Text style={[styles.sheetConfirmTxt, !ready && { color: C.disabledTxt }]}>Send back to inspector</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.muted, marginBottom: 2 },
  sectionLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  plate: { fontFamily: F.sansSemi, fontSize: 16, color: C.ink },
  plateLg: { fontFamily: F.sansSemi, fontSize: 17, color: C.ink, letterSpacing: 0.2 },
  tag: { fontFamily: F.monoMed, fontSize: 11 },
  meta: { fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.muted },
  metaMono: { fontFamily: F.mono, fontSize: 11.5, color: C.muted },

  returnedCard: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.danger, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, gap: 8, ...cardShadow },
  reason: { fontFamily: F.sansMed, fontSize: 14, lineHeight: 20, color: C.ink },
  redoBtn: { minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  redoTxt: { fontFamily: F.sansSemi, fontSize: 15, color: '#fff' },

  queueCard: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.amber, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, gap: 9, ...cardShadow },
  subToggle: { backgroundColor: C.tintBlue, borderWidth: 1, borderColor: C.tintBlueBorder, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subToggleTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.primary },
  subPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: C.card },
  subCap: { fontFamily: F.monoSemi, fontSize: 10, letterSpacing: 0.4, color: C.muted3 },
  subVal: { fontFamily: F.sansSemi, fontSize: 13.5, lineHeight: 18, color: C.ink, marginTop: 3 },
  photoTile: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.border2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, overflow: 'hidden' },
  photoTileImg: { ...StyleSheet.absoluteFillObject },
  photoTileTxt: { fontFamily: F.monoSemi, fontSize: 9, lineHeight: 11, color: C.muted3, textAlign: 'center' },
  failDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.danger, marginTop: 6 },
  failTxt: { flex: 1, fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.ink },
  cleanTxt: { fontFamily: F.sansMed, fontSize: 13, color: C.green },
  signedBy: { fontFamily: F.mono, fontSize: 11.5, color: C.muted3, borderTopWidth: 1, borderTopColor: C.hair, paddingTop: 8 },

  approveBtn: { flex: 2, minHeight: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.primary },
  approveTxt: { fontFamily: F.sansSemi, fontSize: 15, color: '#fff' },
  sendBackBtn: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  sendBackTxt: { fontFamily: F.sansSemi, fontSize: 15, color: C.muted },
  note: { fontFamily: F.monoMed, fontSize: 12, color: C.muted3 },

  emptyCard: { borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.cardAlt, padding: 16 },
  emptyTxt: { fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted },

  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 },
  segment: { flexDirection: 'row', gap: 6 },
  segBtn: { minHeight: CTRL.sm, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  segBtnOn: { borderColor: C.primary, backgroundColor: C.chipBlue },
  segTxt: { fontFamily: F.sansSemi, fontSize: 12, color: C.muted2 },
  segTxtOn: { color: C.primary },

  approvedRow: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...cardShadow },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,33,38,0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 26, gap: 13 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetTitle: { fontFamily: F.sansBold, fontSize: 17, color: C.ink },
  sheetX: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sheetInput: { minHeight: 76, borderWidth: 1, borderColor: C.border3, borderRadius: 12, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 10, fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink, textAlignVertical: 'top' },
  sheetConfirm: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetConfirmTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
});
