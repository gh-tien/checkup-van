import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F, cardShadow } from '../theme';

// One person's record, read-only. Role changes live in the Personnel Management sheet, which the
// "Manage" pill opens — so this screen is about *who* somebody is and *what they have done*, and
// never asks the reader to work out whether they are looking at a form or a summary.
export default function ProfileScreen() {
  const s = useStore();
  const st = s.state;
  const person = s.personRecord();
  const me = s.resolvedPerson();
  const eff = s.roleOf(person.name);
  const isAdminRole = eff === 'Admin';
  const canManage = s.isManager() && person.name !== me;

  const stats = s.statsFor(person.name);
  const caps = s.capsUpTo(eff)
    .flatMap((g) => g.caps.map((c) => ({ role: g.role, name: c.name })))
    .filter((c) => s.capOn(c.role, c.name));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 32 }}>
      {/* Editorial header: name and role read as one left-aligned block, the way a record header
          should — the centred avatar stack made a roster entry look like a social profile. */}
      <View style={styles.head}>
        <View style={styles.av}><Text style={styles.avTxt}>{person.ini}</Text></View>

        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={styles.role}>{s.roleLabel(eff)}</Text>
            {!!person.suspended && (
              <>
                <Text style={styles.dotSep}>·</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="lock" size={14} color={C.amber} width={2} />
                  <Text style={styles.suspended}>Suspended</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {canManage && (
          <Pressable
            onPress={() => s.openManagePerson(person.name)}
            accessibilityRole="button"
            accessibilityLabel={'Manage ' + person.name}
            style={styles.managePill}
          >
            <Icon name="gear" size={15} color={C.primary} width={1.8} />
            <Text style={styles.managePillTxt}>Manage</Text>
          </Pressable>
        )}
      </View>

      {/* Counts come from the approved/queue records themselves, so they can never disagree with
          what Approvals shows. Admin accounts don't run checks, so they get no figures. */}
      {!isAdminRole && (
        <View style={styles.statCard}>
          <Stat
            n={stats.month}
            cap="Checks this month"
            onPress={() => { s.setApprovedPeriod('month'); s.go('approved'); }}
          />
          <View style={styles.statDivider} />
          <Stat
            n={stats.week}
            cap="This week"
            onPress={() => { s.setApprovedPeriod('week'); s.go('approved'); }}
          />
        </View>
      )}

      <Text style={styles.section}>Details</Text>
      <View style={styles.card}>
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

        <View style={[styles.row, styles.hairline]}>
          <Text style={[styles.rowKey, { flex: 1 }]}>Last active</Text>
          <Text style={styles.rowVal}>{person.name === me ? 'Now' : 'Today · 08:12'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowKey, { flex: 1 }]}>Member since</Text>
          <Text style={styles.rowVal}>{person.since || '—'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ n, cap, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={n + ' — ' + cap}
      style={styles.stat}
    >
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statCap}>{cap}</Text>
    </Pressable>
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

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  av: { width: 60, height: 60, borderRadius: 999, flexShrink: 0, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontFamily: F.sansBold, fontSize: 21, color: '#fff', letterSpacing: 0.4 },
  name: { fontFamily: F.sansBold, fontSize: 21, color: C.ink, letterSpacing: -0.4 },
  role: { fontFamily: F.sansBold, fontSize: 13, color: C.primary },
  dotSep: { fontFamily: F.sans, fontSize: 13, color: C.borderMuted },
  suspended: { fontFamily: F.sansSemi, fontSize: 13, color: C.amber },

  managePill: {
    flexShrink: 0, minHeight: 42, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    gap: 7, borderRadius: 999, borderWidth: 1, borderColor: C.primary, backgroundColor: C.card,
  },
  managePillTxt: { fontFamily: F.sansSemi, fontSize: 14, color: C.primary },

  // One card split down the middle rather than two tiles: the figures are the same measure, so
  // they compare at a glance instead of reading as two unrelated boxes.
  statCard: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.card, borderWidth: 1,
    borderColor: C.border, borderRadius: 16, ...cardShadow,
  },
  stat: { flex: 1, paddingVertical: 16, paddingHorizontal: 18, gap: 3 },
  statN: { fontFamily: F.sansBold, fontSize: 28, lineHeight: 30, color: C.ink, letterSpacing: -0.6 },
  statCap: { fontFamily: F.sansMed, fontSize: 12.5, color: C.muted3 },
  statDivider: { width: 1, backgroundColor: C.hair, marginVertical: 14 },

  section: { fontFamily: F.sansSemi, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted3, paddingLeft: 2 },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, ...cardShadow,
  },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  rowKey: { fontFamily: F.sans, fontSize: 14.5, lineHeight: 20, color: C.muted2 },
  rowVal: { fontFamily: F.sansMed, fontSize: 14.5, lineHeight: 20, color: C.ink },
  chevOpen: { transform: [{ rotate: '180deg' }] },

  capsHint: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.muted },
  capChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: C.chipBlue },
  capChipTxt: { fontFamily: F.sansMed, fontSize: 13, color: C.primary },
});
