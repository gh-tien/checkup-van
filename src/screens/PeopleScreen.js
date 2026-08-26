import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F, cardShadow } from '../theme';
import { plural } from '../format';

// Personnel Management — the roster of everyone at this depot, System Admin included. Managers get
// the manage affordances (the "…" on each row and the add-person button); an Inspector sees the
// same list read-only and can only open themselves.
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const s = useStore();
  const st = s.state;
  const me = s.resolvedPerson();
  const canManage = s.isManager();
  const rows = s.peopleList();
  const suspended = st.people.filter((p) => p.suspended).length;

  const sub = plural(st.people.length, 'person', 'people') + ' · '
    + (suspended ? plural(suspended, 'suspended', 'suspended') : 'all active');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }}>
        <Text style={styles.sub}>{sub}</Text>

        {/* Segmented control: one track, the selected segment lifts out of it on white. */}
        <View style={styles.segTrack}>
          <FilterSeg label="All" on={st.peopleFilter === 'all'} onPress={() => s.setPeopleFilter('all')} />
          <FilterSeg label="Managers" on={st.peopleFilter === 'Manager'} onPress={() => s.setPeopleFilter('Manager')} />
          <FilterSeg label="Inspectors" on={st.peopleFilter === 'Inspector'} onPress={() => s.setPeopleFilter('Inspector')} />
        </View>

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>
              {st.peopleFilter === 'Manager' ? 'No managers at this depot yet.' : 'No inspectors at this depot yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((p, i) => (
              <PersonRow key={p.name} person={p} me={me} canManage={canManage} last={i === rows.length - 1} />
            ))}
          </View>
        )}
      </ScrollView>

      {canManage && (
        <Pressable
          onPress={() => s.openAddPerson()}
          accessibilityRole="button"
          accessibilityLabel="Add a person"
          style={[styles.fab, { bottom: 74 + Math.max(10, insets.bottom) }]}
          hitSlop={6}
        >
          <Icon name="plus" size={24} color="#fff" width={2.4} />
        </Pressable>
      )}
    </View>
  );
}

function PersonRow({ person, me, canManage, last }) {
  const s = useStore();
  const eff = s.roleOf(person.name);
  const mgr = eff === 'Manager' || eff === 'Admin';
  const susp = !!person.suspended;
  const you = person.name === me;

  const open = () => {
    if (you || canManage) return s.openPerson(person.name);
    s.say('Only a manager can open another person.');
  };

  return (
    <View style={[styles.row, !last && styles.hairline]}>
      <Pressable onPress={open} accessibilityRole="button" style={styles.rowMain}>
        <View style={[styles.av, susp ? styles.avSusp : mgr ? styles.avMgr : styles.avInsp]}>
          <Text style={[styles.avTxt, { color: susp ? C.muted3 : mgr ? '#fff' : C.primary }]}>{person.ini}</Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
            {you && <Text style={styles.youChip}>YOU</Text>}
          </View>
          {/* Status and role read as one line — the dot is decoration, the words carry the state. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={[styles.dot, { backgroundColor: susp ? C.amber : C.primary }]} />
            <Text style={styles.status}>{susp ? 'Suspended' : 'Active'}</Text>
            <Text style={styles.sep}>/</Text>
            <Text style={[styles.roleTxt, { color: susp ? C.amber : mgr ? C.primary : C.muted2 }]}>
              {s.roleLabel(eff)}
            </Text>
          </View>
        </View>
      </Pressable>

      {canManage && (
        <Pressable
          onPress={() => s.openManagePerson(person.name)}
          accessibilityRole="button"
          accessibilityLabel={'Manage ' + person.name}
          style={styles.dots}
        >
          <Icon name="dots" size={18} color={C.faint} width={2} />
        </Pressable>
      )}
    </View>
  );
}

// Filter segments live inside a shared track — selection reads as a raised tile, not a fill.
function FilterSeg({ label, on, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      hitSlop={{ top: 3, bottom: 3 }}
      style={[styles.filterSeg, on && styles.filterSegOn]}
    >
      <Text style={[styles.filterSegTxt, on && styles.filterSegTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: F.sansMed, fontSize: 12.5, letterSpacing: 0.2, color: C.muted3 },

  segTrack: { flexDirection: 'row', gap: 3, backgroundColor: C.border2, borderRadius: 12, padding: 3 },
  filterSeg: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterSegOn: {
    backgroundColor: C.card,
    shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  filterSegTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.muted3 },
  filterSegTxtOn: { color: C.ink },

  list: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    overflow: 'hidden', ...cardShadow,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },
  rowMain: { flex: 1, minWidth: 0, minHeight: 68, paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 13 },

  av: { width: 42, height: 42, borderRadius: 999, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  avMgr: { backgroundColor: C.primary },
  avInsp: { backgroundColor: C.chipBlue },
  avSusp: { backgroundColor: C.border2 },
  avTxt: { fontFamily: F.sansBold, fontSize: 14.5, letterSpacing: 0.3 },

  name: { flexShrink: 1, fontFamily: F.sansSemi, fontSize: 16, color: C.ink },
  youChip: {
    fontFamily: F.monoSemi, fontSize: 9.5, color: C.primary, backgroundColor: C.chipBlue,
    paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, overflow: 'hidden',
  },
  dot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
  status: { fontFamily: F.sansMed, fontSize: 12.5, color: C.muted },
  sep: { fontFamily: F.sans, fontSize: 12.5, color: C.borderMuted },
  roleTxt: { fontFamily: F.sansBold, fontSize: 12.5 },

  dots: { width: 46, height: 68, alignItems: 'center', justifyContent: 'center' },

  empty: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 18, alignItems: 'center', ...cardShadow,
  },
  emptyTxt: { fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.muted, textAlign: 'center' },

  fab: {
    position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 999,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

});
