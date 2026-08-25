import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useStore, STATUS } from '../store';
import Icon from '../components/Icon';
import { plural } from '../format';
import { C, F, CTRL, cardShadow } from '../theme';

const CHIPS = [
  ['all', 'All'],
  ['overdue', 'Overdue'],
  ['jobs', 'Open defects'],
  ['blocked', 'Attention'],
];

export default function FleetScreen() {
  const s = useStore();
  const st = s.state;
  const q = (st.fleetQuery || '').trim().toLowerCase();

  const counts = {
    overdue: st.fleet.filter((v) => s.isOverdue(v)).length,
    jobs: st.fleet.filter((v) => s.hasJobs(v)).length,
    blocked: st.fleet.filter((v) => v.blocked).length,
  };

  const rows = st.fleet.filter((v) => {
    if (st.fleetFilter === 'overdue' && !s.isOverdue(v)) return false;
    if (st.fleetFilter === 'jobs' && !s.hasJobs(v)) return false;
    if (st.fleetFilter === 'blocked' && !v.blocked) return false;
    if (!q) return true;
    return v.plate.toLowerCase().includes(q) || (v.model || '').toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sticky}>
        <View style={styles.searchWrap}>
          <View style={styles.searchIcon} pointerEvents="none">
            <Icon name="search" size={16} color={C.muted3} width={2} />
          </View>
          <TextInput
            value={st.fleetQuery}
            onChangeText={(v) => s.onFleetQuery(v)}
            placeholder="Search plate or model…"
            placeholderTextColor={C.muted3}
            accessibilityLabel="Search fleet"
            autoCorrect={false}
            style={styles.search}
          />
          {!!q && (
            <Pressable onPress={() => s.clearFleetQuery()} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={6}>
              <Icon name="x" size={15} color={C.muted3} width={2} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 2 }}>
          {CHIPS.map(([key, label]) => {
            const on = st.fleetFilter === key;
            const text = key === 'all' ? label : label + ' ' + counts[key];
            return (
              <Pressable
                key={key}
                onPress={() => s.setFleetFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{text}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.count}>
          {plural(rows.length, 'vehicle')} of {st.fleet.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        {rows.map((v) => {
          const stat = STATUS[s.statOf(v)];
          return (
            <Pressable key={v.plate} onPress={() => s.goVan(v.plate)} accessibilityRole="button" style={styles.row}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.plate}>{v.plate}</Text>
                <Text style={styles.sub}>{v.model} · Bay {v.bay}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: stat.bg }]}>
                <Text style={[styles.badgeTxt, { color: stat.c }]}>{stat.label}</Text>
              </View>
              <Icon name="chevronRight" size={16} color={C.faint} width={2} />
            </Pressable>
          );
        })}
        {rows.length === 0 && <Text style={styles.empty}>No vehicles match.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sticky: {
    backgroundColor: C.card, gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.border2,
  },
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 11, zIndex: 1 },
  search: {
    minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 34, fontFamily: F.sans, fontSize: 14.5, color: C.ink, backgroundColor: C.inputBg,
  },
  clear: { position: 'absolute', right: 4, width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: CTRL.sm, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  chipOn: { borderColor: C.primary, backgroundColor: C.primary },
  chipTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted2 },
  chipTxtOn: { color: '#fff' },
  count: { fontFamily: F.sans, fontSize: 12, color: C.muted3 },
  row: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    ...cardShadow,
  },
  plate: { fontFamily: F.sansSemi, fontSize: 16.5, color: C.ink, letterSpacing: 0.2 },
  sub: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },
  badge: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  badgeTxt: { fontFamily: F.monoBold, fontSize: 10 },
  empty: { fontFamily: F.sans, fontSize: 14, color: C.muted },
});
