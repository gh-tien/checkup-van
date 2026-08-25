import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { APP_BUILD } from '../data/model';
import Icon from '../components/Icon';
import { C, F, cardShadow } from '../theme';

export default function SettingsScreen() {
  const s = useStore();
  const st = s.state;
  const meta = st.backupMeta;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Depot</Text>
      <View style={styles.field}>
        <Text style={styles.fieldCap}>Depot name</Text>
        <TextInput
          value={st.depotName}
          onChangeText={(v) => s.setDepot(v)}
          onBlur={() => s.commitDepot()}
          maxLength={40}
          accessibilityLabel="Depot name"
          style={styles.fieldInput}
        />
      </View>

      <Text style={[styles.label, { paddingTop: 8 }]}>App</Text>
      <Pressable onPress={() => s.go('config')} accessibilityRole="button" style={styles.navRow}>
        <Icon name="listCheck" size={22} color={C.primary} width={1.7} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.navTitle}>Depot configuration</Text>
        </View>
        <Icon name="chevronRight" size={16} color={C.faint} width={2} />
      </Pressable>

      <Text style={[styles.label, { paddingTop: 8 }]}>Backup</Text>
      {st.restoreOpen && meta ? (
        <View style={styles.restore}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Text style={styles.restoreTitle}>Backup on this device</Text>
            <Text style={styles.restoreWarn}>Replaces everything</Text>
          </View>
          <Text style={styles.label}>Saved {meta.savedAt}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat n={meta.vans} cap="Vehicles" />
            <Stat n={meta.checks} cap="Checks" />
            <Stat n={meta.defects} cap="Defects" />
          </View>
          <Text style={styles.restoreBody}>
            Restoring puts this backup in place of everything on this phone — every vehicle, person,
            check and defect. What is here now is gone unless you save a backup of it first.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => s.cancelRestore()} accessibilityRole="button" style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => s.confirmRestore()} accessibilityRole="button" style={styles.replaceBtn}>
              <Text style={styles.replaceTxt}>Replace everything</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Pressable onPress={() => s.doBackup()} accessibilityRole="button" style={[styles.cardRow, styles.hairline]}>
            <Icon name="download" size={21} color={C.primary} width={1.7} />
            <Text style={styles.cardRowTxt}>Save a backup</Text>
          </Pressable>
          <Pressable onPress={() => s.openRestore()} accessibilityRole="button" style={styles.cardRow}>
            <Icon name="upload" size={21} color={C.primary} width={1.7} />
            <Text style={styles.cardRowTxt}>Restore from a backup</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.note}>
        {meta ? 'Last backup saved ' + meta.savedAt + ' — ' + meta.vans + ' vehicles, ' + meta.checks + ' checks.'
          : 'No backup saved yet.'}
      </Text>

      <Text style={[styles.label, { paddingTop: 8 }]}>About</Text>
      <View style={styles.card}>
        <View style={[styles.aboutRow, styles.hairline]}>
          <Text style={styles.aboutKey}>App build</Text>
          <Text style={styles.aboutVal}>{APP_BUILD}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutKey}>Checklist</Text>
          <Text style={styles.aboutVal}>{'v' + st.clVersion}</Text>
        </View>
      </View>

      <Text style={[styles.label, { paddingTop: 8, fontFamily: F.sansBold, color: C.danger }]}>Danger zone</Text>
      <Pressable onPress={() => s.openResetModal()} accessibilityRole="button" style={styles.resetBtn}>
        <Text style={styles.resetTxt}>Factory Reset</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ n, cap }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statCap}>{cap}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.sansSemi, fontSize: 12.5, lineHeight: 17, color: C.muted },
  note: { fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.muted },

  field: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, minHeight: 52, justifyContent: 'center', gap: 2,
  },
  fieldCap: { fontFamily: F.sansMed, fontSize: 12, color: C.muted },
  fieldInput: { fontFamily: F.sansMed, fontSize: 16, color: C.primary, padding: 0, minHeight: 24 },

  navRow: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 14, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, ...cardShadow,
  },
  navTitle: { fontFamily: F.sansMed, fontSize: 16, color: C.ink },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    overflow: 'hidden', ...cardShadow,
  },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },
  cardRow: { paddingHorizontal: 14, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardRowTxt: { flex: 1, fontFamily: F.sansMed, fontSize: 15.5, color: C.ink },

  aboutRow: { paddingHorizontal: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aboutKey: { fontFamily: F.sans, fontSize: 14.5, color: C.muted2 },
  aboutVal: { fontFamily: F.monoMed, fontSize: 13, color: C.ink },

  restore: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.danger, borderRadius: 16, padding: 14, gap: 10 },
  restoreTitle: { fontFamily: F.sansSemi, fontSize: 16, color: C.ink },
  restoreWarn: { fontFamily: F.monoMed, fontSize: 11, color: C.danger },
  restoreBody: { fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.muted2 },
  stat: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', ...cardShadow,
  },
  statN: { fontFamily: F.sansSemi, fontSize: 24, color: C.ink },
  statCap: { fontFamily: F.sansMed, fontSize: 12, color: C.muted, marginTop: 3 },

  cancelBtn: {
    flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  cancelTxt: { fontFamily: F.sansMed, fontSize: 16, color: C.muted },
  replaceBtn: { flex: 2, minHeight: 52, borderRadius: 16, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  replaceTxt: { fontFamily: F.sansMed, fontSize: 16, color: '#fff' },

  resetBtn: { backgroundColor: C.danger, borderRadius: 16, minHeight: 56, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  resetTxt: { fontFamily: F.sansSemi, fontSize: 15.5, color: '#fff' },
});
