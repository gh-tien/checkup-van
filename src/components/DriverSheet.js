import React from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { initials } from '../data/model';
import Icon from './Icon';
import { C, F, CTRL } from '../theme';

// The driver-confirm launch gate. A bottom sheet that pops over the Dashboard/Fleet so the
// vehicle context stays visible; the full-screen walk-around wizard only opens on Confirm.
// Happy path is one tap: a driver is on file, so the sheet is just identity card → Confirm.
// Reassigning ("someone else has it") is one tap away behind the pencil, kept off the default view.
export default function DriverSheet() {
  const s = useStore();
  const st = s.state;
  const plate = st.driverSheet;
  const v = st.fleet.find((x) => x.plate === plate);
  const onFile = v && v.driver && v.driver !== 'Unassigned' ? v.driver : null;

  const noDriver = st.checkNoKeyholder;
  const typed = (st.checkDriver || '').trim();
  const shownName = noDriver ? 'No driver' : (typed || onFile || 'Not on file');
  const changed = !noDriver && !!typed && typed !== onFile;
  const canConfirm = noDriver || !!typed || !!onFile;
  const meta = noDriver ? 'Spare / yard vehicle'
    : changed ? 'Different driver'
    : onFile ? 'Driver on file'
    : 'No driver on file yet';

  // Progressive disclosure: the field is pre-seeded with the on-file name, so gate the reveal on
  // an actual reassignment (`changed`) — not on `typed`. Default view is card → Confirm; the field
  // opens when there's nobody on file, or when you tap the pencil.
  const [editing, setEditing] = React.useState(!onFile);
  const showField = !noDriver && (editing || changed);

  const collapseField = () => {
    s.onChkDriver(onFile || '');
    if (onFile) setEditing(false);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={() => s.closeDriverSheet()}>
      <Pressable onPress={() => s.closeDriverSheet()} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close without starting the check">
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header — the plate leads, so it's clear which vehicle you're about to walk. */}
          <View style={styles.header}>
            <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
              <Text style={styles.plateEyebrow}>{plate}</Text>
              <Text style={styles.title}>Confirm driver to start</Text>
            </View>
            <Pressable onPress={() => s.closeDriverSheet()} style={styles.sheetX} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close without starting the check">
              <Icon name="x" size={16} color={C.muted2} width={2.2} />
            </Pressable>
          </View>

          {/* Who has the vehicle — the name the check will be filed against. */}
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
            {onFile && !noDriver && !showField ? (
              <Pressable onPress={() => setEditing(true)} style={styles.cardBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change driver">
                <Icon name="pen" size={16} color={C.primary} width={1.8} />
              </Pressable>
            ) : null}
          </View>

          {/* Reassign — revealed only when needed, so the default view stays quiet. */}
          {showField ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Someone else driving it?</Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <View style={styles.inputIcon}><Icon name="search" size={18} color={C.muted3} width={1.7} /></View>
                <TextInput
                  value={st.checkDriver}
                  autoFocus={editing}
                  onChangeText={(t) => s.onChkDriver(t)}
                  onFocus={() => { if ((st.checkDriver || '').length) s.onChkDriver(''); }}
                  placeholder="Search a different driver"
                  placeholderTextColor={C.muted3}
                  style={[styles.input, { paddingLeft: 40, paddingRight: (typed || onFile) ? 40 : 13 }]}
                />
                {typed || onFile ? (
                  <Pressable
                    onPress={collapseField}
                    hitSlop={8}
                    style={styles.inputClear}
                    accessibilityRole="button"
                    accessibilityLabel={onFile ? `Cancel — keep ${onFile}` : 'Clear driver'}
                  >
                    <Icon name="x" size={16} color={C.muted3} width={2} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Spare / yard vehicle — no driver to record. */}
          <Pressable
            onPress={() => s.toggleNoKeyholder()}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: noDriver }}
            accessibilityLabel="Vehicle not in use, spare"
            style={styles.spareRow}
          >
            <View style={[styles.checkbox, noDriver && styles.checkboxOn]}>
              {noDriver && <Icon name="check" size={14} color="#fff" width={3} />}
            </View>
            <Text style={styles.spareTxt}>Vehicle not in use (spare)</Text>
          </Pressable>

          {/* The one commitment. Spare → draw a random replacement; otherwise → the walk-around. */}
          <Pressable
            onPress={() => (noDriver ? s.skipAsSpare() : s.confirmDriverStart())}
            disabled={!canConfirm}
            style={[styles.primaryBtn, !canConfirm && styles.primaryBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={noDriver
              ? 'Mark not in use and draw a random vehicle to check'
              : `Confirm ${shownName} and start the walk-around`}
          >
            <Text style={[styles.primaryBtnText, !canConfirm && styles.primaryBtnTextOff]}>{noDriver ? 'Random Check' : 'Confirm'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(27,33,38,.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30, gap: 16 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.border3, marginBottom: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  plateEyebrow: { fontFamily: F.monoBold, fontSize: 15, letterSpacing: 1.2, color: C.muted2 },
  title: { fontFamily: F.sansBold, fontSize: 18, color: C.ink },
  sheetX: { width: CTRL.sm, height: CTRL.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted },
  inputIcon: { position: 'absolute', left: 13, zIndex: 1 },
  inputClear: { position: 'absolute', right: 11, zIndex: 1 },
  input: { borderWidth: 1, borderColor: C.border3, borderRadius: 12, minHeight: CTRL.md, paddingHorizontal: 13, fontFamily: F.sansMed, fontSize: 15, color: C.ink, backgroundColor: C.card },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.tintBlue, borderWidth: 1, borderColor: C.tintBlueBorder, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  driverAv: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  driverAvMuted: { backgroundColor: C.chipBlue },
  driverAvTxt: { fontFamily: F.sansBold, fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  driverName: { fontFamily: F.sansBold, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
  driverMeta: { fontFamily: F.sansMed, fontSize: 12, color: C.muted, marginTop: 2 },
  cardBtn: { width: CTRL.sm, height: CTRL.sm, alignItems: 'center', justifyContent: 'center' },
  spareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: CTRL.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.6, borderColor: C.border3, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  spareTxt: { fontFamily: F.sansMed, fontSize: 14, color: C.ink },
  primaryBtn: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  primaryBtnOff: { backgroundColor: C.disabledBg },
  primaryBtnText: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
  primaryBtnTextOff: { color: C.disabledTxt },
});
