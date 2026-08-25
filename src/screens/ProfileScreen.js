import React from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet } from 'react-native';
import { useStore, STATUS } from '../store';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';
import { fmtDate, plural } from '../format';

// One person's record. An Admin looking at somebody else gets the editable role block (segments,
// the system-admin switch, and a sticky Discard / Save bar); everyone else — including an Admin
// looking at themselves — gets the same information read-only.
export default function ProfileScreen() {
  const s = useStore();
  const st = s.state;
  const person = s.personRecord();
  const me = s.resolvedPerson();
  const eff = s.effRole();
  const isAdminRole = eff === 'Admin';
  const baseRole = s.baseRoleOf(eff);
  const editable = s.isAdmin() && person.name !== me;
  const canGrantAdmin = editable && baseRole === 'Manager';
  const dirty = s.roleDirty();

  const stats = s.statsFor(person.name);
  const vans = s.vansFor(person.name);
  const caps = s.capsUpTo(eff)
    .flatMap((g) => g.caps.map((c) => ({ role: g.role, name: c.name })))
    .filter((c) => s.capOn(c.role, c.name));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: dirty ? 24 : 32 }}>
        {/* Identity */}
        <View style={styles.head}>
          <View style={styles.bigAv}>
            <Text style={styles.bigAvTxt}>{person.ini}</Text>
          </View>
          <Text style={styles.bigName}>{person.name}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillTxt}>{s.roleLabel(eff)}</Text>
          </View>
          {!!person.suspended && (
            <View style={styles.suspPill}>
              <Icon name="lock" size={13} color={C.amber} width={1.9} />
              <Text style={styles.suspPillTxt}>Suspended — cannot sign in</Text>
            </View>
          )}
        </View>

        {/* Counts come from the approved/queue records themselves, so they can never disagree
            with what Approvals shows. Admin accounts don't run checks, so they get no tiles. */}
        {!isAdminRole && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              n={stats.month}
              cap="This month"
              onPress={() => { s.setApprovedPeriod('month'); s.go('approved'); }}
            />
            <StatTile
              n={stats.week}
              cap="This week"
              onPress={() => { s.setApprovedPeriod('week'); s.go('approved'); }}
            />
          </View>
        )}

        <Text style={styles.section}>Details</Text>
        <View style={styles.card}>
          {editable ? (
            <View style={[styles.block, styles.hairline]}>
              <Text style={styles.rowKey}>Role</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Seg label="Inspector" on={baseRole === 'Inspector'} onPress={() => s.setDraftRole('Inspector')} />
                <Seg label="Manager" on={baseRole === 'Manager'} onPress={() => s.setDraftRole('Manager')} />
              </View>

              {canGrantAdmin && (
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: isAdminRole ? C.ink : C.muted2 }]}>
                    System admin access
                  </Text>
                  <Switch
                    value={isAdminRole}
                    onValueChange={() => s.toggleGrantAdmin()}
                    trackColor={{ false: C.border3, true: C.primary }}
                    thumbColor="#fff"
                    accessibilityLabel="System admin access"
                  />
                </View>
              )}

              <CapsToggle open={st.profCapsOpen} caps={caps} onPress={() => s.toggleProfCaps()} />
            </View>
          ) : (
            <View style={styles.hairline}>
              <Pressable onPress={() => s.toggleProfRole()} accessibilityRole="button" style={styles.row}>
                <Text style={[styles.rowKey, { flex: 1 }]}>Role</Text>
                <Text style={styles.rowVal}>{s.roleLabel(eff)}</Text>
                <View style={st.profRoleOpen ? styles.chevOpen : null}>
                  <Icon name="chevronDown" size={15} color={C.faint} width={2} />
                </View>
              </Pressable>
              {st.profRoleOpen && (
                <View style={{ paddingBottom: 14, gap: 8 }}>
                  <Text style={styles.capsHint}>View permission</Text>
                  <CapChips caps={caps} />
                </View>
              )}
            </View>
          )}

          <View style={[styles.row, styles.hairline]}>
            <Text style={[styles.rowKey, { flex: 1 }]}>Last active</Text>
            <Text style={styles.rowVal}>{person.name === me ? 'Now' : 'Today · 08:12'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowKey, { flex: 1 }]}>Member since</Text>
            <Text style={styles.rowVal}>{person.since || '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Assigned vehicles</Text>
          <Text style={styles.sectionCount}>{vans.length === 0 ? 'none' : plural(vans.length, 'vehicle')}</Text>
        </View>

        {vans.length === 0 ? (
          <View style={styles.noVans}>
            <Text style={styles.noVansTxt}>No vehicle currently assigned to {person.name}.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {vans.map((v, i) => (
              <VanRow key={v.plate} van={v} last={i === vans.length - 1} />
            ))}
          </View>
        )}
      </ScrollView>

      {dirty && (
        <View style={styles.saveBar}>
          <Pressable onPress={() => s.discardRole()} accessibilityRole="button" style={styles.discardBtn}>
            <Text style={styles.discardTxt}>Discard</Text>
          </Pressable>
          <Pressable onPress={() => s.saveRole()} accessibilityRole="button" style={styles.saveBtn}>
            <Text style={styles.saveTxt}>Save changes</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StatTile({ n, cap, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.tile}>
      <Text style={styles.tileN}>{n}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
        <Text style={styles.tileCap}>{cap}</Text>
        <Icon name="chevronRight" size={12} color={C.primary} width={2.4} />
      </View>
    </Pressable>
  );
}

function CapsToggle({ open, caps, onPress }) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.capsBtn}>
        <Text style={styles.capsBtnTxt}>View permission</Text>
        <View style={open ? styles.chevOpen : null}>
          <Icon name="chevronDown" size={15} color={C.primary} width={2} />
        </View>
      </Pressable>
      {open && <CapChips caps={caps} />}
    </View>
  );
}

function CapChips({ caps }) {
  if (!caps.length) {
    return <Text style={styles.capsHint}>No capabilities enabled for this role.</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {caps.map((c) => (
        <View key={c.role + '·' + c.name} style={styles.capChip}>
          <Text style={styles.capChipTxt}>{c.name}</Text>
        </View>
      ))}
    </View>
  );
}

function VanRow({ van, last }) {
  const s = useStore();
  // The pill word and its colour both come from the same status key, so the two can never disagree.
  const key = s.statOf(van);
  const stat = STATUS[key];
  const pill = key === 'blocked' ? 'attention'
    : key === 'jobs' ? plural(van.jobs.length, 'def', 'def')
    : key === 'overdue' ? 'overdue' : 'ok';

  return (
    <Pressable
      onPress={() => s.goVan(van.plate)}
      accessibilityRole="button"
      accessibilityLabel={van.plate + ' — ' + stat.label}
      style={[styles.vanRow, !last && styles.hairline]}
    >
      <View style={styles.vanIcon}>
        <Icon name="truck" size={20} color={C.primary} width={1.6} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.vanPlate} numberOfLines={1}>{van.plate}</Text>
        <Text style={styles.vanSub} numberOfLines={1}>
          {van.model + ' · ' + (van.driverSince ? 'driver since ' + fmtDate(van.driverSince) : 'current driver')}
        </Text>
      </View>
      <View style={[styles.vanPill, { backgroundColor: stat.bg }]}>
        <Text style={[styles.vanPillTxt, { color: stat.c }]}>{pill}</Text>
      </View>
      <Icon name="chevronRight" size={15} color={C.faint} width={2} />
    </Pressable>
  );
}

function Seg({ label, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.seg, on && styles.segOn]}
    >
      <Text style={[styles.segTxt, on && styles.segTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 6 },
  bigAv: { width: 76, height: 76, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  bigAvTxt: { fontFamily: F.sansBold, fontSize: 26, color: '#fff', letterSpacing: 0.5 },
  bigName: { fontFamily: F.sansBold, fontSize: 23, color: C.ink, letterSpacing: -0.4, textAlign: 'center' },
  rolePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: C.chipBlue },
  rolePillTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.primary },
  suspPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: C.amberBg,
  },
  suspPillTxt: { fontFamily: F.sansMed, fontSize: 12.5, color: C.amber },

  tile: {
    flex: 1, minWidth: 0, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', ...cardShadow,
  },
  tileN: { fontFamily: F.sansSemi, fontSize: 24, lineHeight: 28, color: C.ink },
  tileCap: { fontFamily: F.sansMed, fontSize: 12, color: C.primary },

  section: { fontFamily: F.sansSemi, fontSize: 12.5, lineHeight: 17, color: C.muted, paddingTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sectionCount: { fontFamily: F.monoMed, fontSize: 11, color: C.muted3 },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, ...cardShadow,
  },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  block: { paddingTop: 12, paddingBottom: 14, gap: 10 },
  rowKey: { fontFamily: F.sans, fontSize: 14.5, lineHeight: 20, color: C.muted2 },
  rowVal: { fontFamily: F.sansMed, fontSize: 14.5, lineHeight: 20, color: C.ink },
  chevOpen: { transform: [{ rotate: '180deg' }] },

  seg: {
    flex: 1, minHeight: CTRL.sm, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  segOn: { borderColor: C.primary, backgroundColor: C.primary },
  segTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.muted2 },
  segTxtOn: { color: '#fff' },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  switchLabel: { flex: 1, minWidth: 0, fontFamily: F.sansMed, fontSize: 14.5 },

  capsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, paddingTop: 4 },
  capsBtnTxt: { flex: 1, fontFamily: F.sansMed, fontSize: 13, color: C.primary },
  capsHint: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.muted },
  capChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: C.chipBlue },
  capChipTxt: { fontFamily: F.sansMed, fontSize: 13, color: C.primary },

  noVans: {
    backgroundColor: C.cardAlt, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border3,
    borderRadius: 16, padding: 16,
  },
  noVansTxt: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 20, color: C.muted, textAlign: 'center' },

  vanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginHorizontal: -14, paddingHorizontal: 14 },
  vanIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.chipBlue, alignItems: 'center', justifyContent: 'center' },
  vanPlate: { fontFamily: F.sansSemi, fontSize: 15, color: C.ink, letterSpacing: 0.3 },
  vanSub: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },
  vanPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  vanPillTxt: { fontFamily: F.monoBold, fontSize: 10 },

  saveBar: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  discardBtn: {
    flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  discardTxt: { fontFamily: F.sansMed, fontSize: 15.5, color: C.muted },
  saveBtn: { flex: 2, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  saveTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
});
