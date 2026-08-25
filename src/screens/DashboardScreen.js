import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useStore, STATUS } from '../store';
import { PEOPLE } from '../data/model';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function useDash() {
  const s = useStore();
  const st = s.state;
  const fleet = st.fleet;
  const total = fleet.length;
  const blocked = fleet.filter((v) => v.blocked).length;
  const overdue = fleet.filter((v) => !v.blocked && (v.last == null || v.last >= 30)).length;
  const ok = Math.max(0, total - blocked - overdue);
  const pct = (n) => (total ? Math.round((n / total) * 100) + '%' : '0%');
  return { st, s, fleet, total, blocked, overdue, ok, pct };
}

export default function DashboardScreen() {
  const { s } = useDash();
  const role = s.personRole();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}>
      {role === 'Inspector' ? <InspectorDash /> : <ManagerDash role={role} />}
    </ScrollView>
  );
}

function InspectorDash() {
  const { s, st, overdue } = useDash();
  const me = st.activePerson || 'Phuog Lam';
  const meStats = PEOPLE[me] || { week: 0, month: 0, defects: 0 };
  const first = me.split(' ')[0];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: F.sansMed, fontSize: 13, color: C.muted }}>{greeting()}</Text>
        <Text style={{ fontFamily: F.sansBold, fontSize: 24, color: C.ink, letterSpacing: -0.2 }}>{first}</Text>
      </View>

      <Pressable
        onPress={() => s.drawCheck(false)}
        accessibilityRole="button"
        accessibilityLabel="Start a full inspection. The app draws the vehicle for you."
        style={styles.heroPrimary}
      >
        <View style={styles.heroIcon}><Icon name="dice" size={27} color="#fff" width={1.7} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 19, color: '#fff' }}>Start a full inspection</Text>
        </View>
        <Icon name="chevronRight" size={18} color="rgba(255,255,255,.9)" width={2.2} />
      </Pressable>

      <VehicleFinder />

      <Text style={styles.sectionLabel}>Your work</Text>

      <Pressable
        onPress={() => s.go('vans')}
        accessibilityRole="button"
        accessibilityLabel={`${overdue} vehicles to check. ${overdue ? 'Overdue a walk-around by 30 days or more' : 'Fleet is up to date'}.`}
        style={[styles.rowCard, cardShadow]}
      >
        <View style={[styles.rowBadge, { backgroundColor: overdue ? C.dangerBg : C.border2 }]}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 16, color: overdue ? C.danger : C.muted2 }}>{overdue}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: C.ink }}>Vehicles to check</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>{overdue ? 'Overdue 30+ days' : 'Fleet is up to date'}</Text>
        </View>
        <Icon name="chevronRight" size={16} color={C.faint} width={2} />
      </Pressable>

      <Text style={styles.sectionLabel}>Your record</Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat n={meStats.week} label="This week" />
        <Stat n={meStats.month} label="This month" />
        <Stat n={meStats.defects} label="Open defects" color={meStats.defects ? C.danger : C.ink} />
      </View>
    </View>
  );
}

function ManagerDash({ role }) {
  const { s, st, total, blocked, overdue, ok, pct } = useDash();
  const me = st.activePerson || 'Tien Nguyen';
  const mine = st.queue.length;
  const inspectors = st.people.filter((p) => p.role === 'Inspector' && !p.suspended);
  const maxWeek = Math.max(1, ...inspectors.map((p) => (PEOPLE[p.name] || {}).week || 0));

  return (
    <View style={{ gap: 14 }}>
      <Pressable
        onPress={() => s.go('approved')}
        accessibilityRole="button"
        accessibilityLabel={mine ? `${mine} full inspections waiting for your sign-off` : 'All approved. Nothing waiting in the queue.'}
        style={[styles.heroPrimary, { backgroundColor: mine ? C.danger : C.primary }]}
      >
        <View style={styles.heroIconSm}><Icon name="check" size={24} color="#fff" width={2} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 18, color: '#fff' }}>{mine ? `${mine} to approve` : 'All approved'}</Text>
        </View>
        <Icon name="chevronRight" size={18} color="rgba(255,255,255,.9)" width={2.2} />
      </Pressable>

      <VehicleFinder />

      <View style={[styles.card, cardShadow, { gap: 11 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted }}>Fleet health · {total} vehicles</Text>
        </View>
        <View style={styles.healthBar} accessibilityLabel={`Fleet health: ${ok} OK, ${overdue} overdue, ${blocked} blocked, of ${total} vehicles`}>
          <View style={{ flex: ok, backgroundColor: C.green }} />
          <View style={{ flex: overdue, backgroundColor: C.slate }} />
          <View style={{ flex: blocked, backgroundColor: C.danger }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Legend color={C.green} label={`OK ${ok}`} />
          <Legend color={C.slate} label={`Overdue ${overdue}`} />
          <Legend color={C.danger} label={`Attention ${blocked}`} />
        </View>
      </View>

      <View style={[styles.card, cardShadow, { gap: 10 }]}>
        <Text style={{ fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted }}>Checks this week by inspector</Text>
        {inspectors.map((p) => {
          const w = (PEOPLE[p.name] || {}).week || 0;
          return (
            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text numberOfLines={1} style={{ width: 58, fontFamily: F.sansMed, fontSize: 12.5, color: C.ink }}>{p.name.split(' ')[0]}</Text>
              <View style={styles.track}>
                <View style={{ height: '100%', borderRadius: 999, backgroundColor: C.primary, width: `${Math.round((w / maxWeek) * 100)}%` }} />
              </View>
              <Text style={{ width: 20, textAlign: 'right', fontFamily: F.monoSemi, fontSize: 12, color: C.muted2 }}>{w}</Text>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => s.drawCheck(false)}
        accessibilityRole="button"
        accessibilityLabel="Run a full inspection"
        style={styles.outlineBtn}
      >
        <Icon name="dice" size={19} color={C.primary} width={1.8} />
        <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: C.primary }}>Run a full inspection</Text>
      </Pressable>
    </View>
  );
}

// Direct-navigation entry the app was missing: the vehicle detail screen is otherwise reachable
// only via Fleet rows, Defects, Approvals or a Profile. Type a plate or model and jump straight
// to the record. Local (not stored) query so it self-clears when you leave the Dashboard.
function VehicleFinder() {
  const s = useStore();
  const [q, setQ] = React.useState('');
  const query = q.trim().toLowerCase();
  const matches = query
    ? s.state.fleet
        .filter((v) => v.plate.toLowerCase().includes(query) || (v.model || '').toLowerCase().includes(query))
        .slice(0, 6)
    : [];

  const open = (plate) => { setQ(''); s.goVan(plate); };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.finderWrap}>
        <View style={styles.finderIcon} pointerEvents="none">
          <Icon name="search" size={16} color={C.muted3} width={2} />
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Find a vehicle — plate or model…"
          placeholderTextColor={C.muted3}
          accessibilityLabel="Find a vehicle by plate or model"
          autoCorrect={false}
          style={styles.finderInput}
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} style={styles.finderClear} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={6}>
            <Icon name="x" size={15} color={C.muted3} width={2} />
          </Pressable>
        )}
      </View>

      {!!query && (
        <View style={[styles.results, cardShadow]}>
          {matches.map((v, i) => {
            const stat = STATUS[s.statOf(v)];
            return (
              <Pressable
                key={v.plate}
                onPress={() => open(v.plate)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${v.plate}, ${v.model}`}
                style={[styles.resultRow, i > 0 && styles.resultDivider]}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.resultPlate}>{v.plate}</Text>
                  <Text style={styles.resultSub} numberOfLines={1}>{v.model} · Bay {v.bay}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: stat.bg }]}>
                  <Text style={[styles.badgeTxt, { color: stat.c }]}>{stat.label}</Text>
                </View>
                <Icon name="chevronRight" size={16} color={C.faint} width={2} />
              </Pressable>
            );
          })}
          {matches.length === 0 && <Text style={styles.resultEmpty}>No vehicles match “{q.trim()}”.</Text>}
        </View>
      )}
    </View>
  );
}

const Stat = ({ n, label, color = C.ink }) => (
  <View style={[styles.stat, cardShadow]}>
    <Text style={{ fontFamily: F.sansBold, fontSize: 24, color }}>{n}</Text>
    <Text style={{ fontFamily: F.sansMed, fontSize: 11.5, color: C.muted }}>{label}</Text>
  </View>
);
const Legend = ({ color, label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color }} />
    <Text style={{ fontFamily: F.sansMed, fontSize: 12, color: C.muted2 }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  heroPrimary: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, backgroundColor: C.primary },
  heroIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  heroIconSm: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 13, gap: 2 },
  sectionLabel: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.muted, paddingTop: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, minHeight: 64 },
  rowBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
  healthBar: { flexDirection: 'row', height: 14, borderRadius: 999, overflow: 'hidden', backgroundColor: C.border2 },
  track: { flex: 1, height: 9, borderRadius: 999, backgroundColor: C.border2, overflow: 'hidden' },
  outlineBtn: { minHeight: CTRL.md, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: C.primary },
  finderWrap: { justifyContent: 'center' },
  finderIcon: { position: 'absolute', left: 11, zIndex: 1 },
  finderInput: {
    minHeight: CTRL.sm, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 34, fontFamily: F.sans, fontSize: 14.5, color: C.ink, backgroundColor: C.inputBg,
  },
  finderClear: { position: 'absolute', right: 4, width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  results: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: CTRL.md },
  resultDivider: { borderTopWidth: 1, borderTopColor: C.border2 },
  resultPlate: { fontFamily: F.sansSemi, fontSize: 15.5, color: C.ink, letterSpacing: 0.2 },
  resultSub: { fontFamily: F.sans, fontSize: 12, color: C.muted },
  badge: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6 },
  badgeTxt: { fontFamily: F.monoBold, fontSize: 10 },
  resultEmpty: { fontFamily: F.sans, fontSize: 13.5, color: C.muted, padding: 14 },
});
