import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';
import { plural } from '../format';

// Roster of everyone at this depot. Managers get the manage affordances (the "…" on each row and
// the add-person button); an Inspector sees the same list read-only and can only open themselves.
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const s = useStore();
  const st = s.state;
  const me = s.resolvedPerson();
  const canManage = s.isManager();
  const roster = s.roster();
  const rows = s.peopleList();
  const suspended = roster.filter((p) => p.suspended).length;

  const sub = plural(roster.length, 'person', 'people') + ' · '
    + (suspended ? plural(suspended, 'suspended', 'suspended') : 'all active');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 96 }}>
        <Text style={styles.sub}>{sub}</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Seg label="All" on={st.peopleFilter === 'all'} onPress={() => s.setPeopleFilter('all')} />
          <Seg label="Managers" on={st.peopleFilter === 'Manager'} onPress={() => s.setPeopleFilter('Manager')} />
          <Seg label="Inspectors" on={st.peopleFilter === 'Inspector'} onPress={() => s.setPeopleFilter('Inspector')} />
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

      {!!st.peopleSheet && (st.peopleSheet.mode === 'add' ? <AddSheet /> : <ManageSheet />)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: susp ? C.amber : C.primary }]} />
            <Text style={styles.status}>{susp ? 'Suspended' : 'Active'}</Text>
          </View>
        </View>

        <View style={[styles.chip, susp ? styles.chipSusp : mgr ? styles.chipMgr : styles.chipInsp]}>
          <Text style={[styles.chipTxt, { color: susp ? C.amber : mgr ? C.primary : C.muted2 }]}>
            {susp ? 'Suspended' : s.roleLabel(eff)}
          </Text>
        </View>
      </Pressable>

      {canManage && (
        <Pressable
          onPress={() => s.openManagePerson(person.name)}
          accessibilityRole="button"
          accessibilityLabel={'Manage ' + person.name}
          style={styles.dots}
        >
          <Icon name="dots" size={18} color={C.muted3} width={2} />
        </Pressable>
      )}
    </View>
  );
}

function AddSheet() {
  const s = useStore();
  const st = s.state;
  const ready = !!(st.peopleNew || '').trim();

  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => s.closePeopleSheet()} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Add a person</Text>
          <Pressable onPress={() => s.closePeopleSheet()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Full name</Text>
          <TextInput
            value={st.peopleNew}
            onChangeText={(v) => s.onPeopleNew(v)}
            placeholder="e.g. Sam Rivera"
            placeholderTextColor={C.muted3}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Full name"
            style={styles.input}
          />
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Seg label="Inspector" on={st.peopleNewRole === 'Inspector'} onPress={() => s.setNewRole('Inspector')} />
            <Seg label="Manager" on={st.peopleNewRole === 'Manager'} onPress={() => s.setNewRole('Manager')} />
          </View>
        </View>

        <Pressable
          onPress={() => s.addPerson()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          accessibilityHint={ready ? undefined : 'Enter a name first'}
          style={[styles.primaryBtn, { backgroundColor: ready ? C.primary : C.disabledBg }]}
        >
          <Text style={[styles.primaryTxt, !ready && { color: C.disabledTxt }]}>Add to depot</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ManageSheet() {
  const s = useStore();
  const st = s.state;
  const name = st.peopleSheet.name;
  const person = st.people.find((p) => p.name === name) || { name, suspended: false };
  const self = name === s.resolvedPerson();

  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => s.closePeopleSheet()} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle} numberOfLines={1}>{name}</Text>
          <Pressable onPress={() => s.closePeopleSheet()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
            <Icon name="x" size={15} color={C.muted2} width={2.2} />
          </Pressable>
        </View>

        <Text style={styles.sheetBody}>
          Suspending keeps every check they signed but stops them signing in. Deleting is for someone
          added by mistake — records they signed keep their name.
        </Text>

        <Pressable onPress={() => s.toggleSuspend(name)} accessibilityRole="button" style={styles.suspendBtn}>
          <Text style={styles.suspendTxt}>{person.suspended ? 'Reinstate ' + name : 'Suspend ' + name}</Text>
        </Pressable>

        {self ? (
          <Text style={styles.selfNote}>You can’t delete your own account</Text>
        ) : (
          <Pressable onPress={() => s.deletePerson(name)} accessibilityRole="button" style={styles.deleteBtn}>
            <Icon name="trash" size={16} color={C.danger} width={1.9} />
            <Text style={styles.deleteTxt}>Delete from depot</Text>
          </Pressable>
        )}
      </View>
    </View>
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
  sub: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.muted },

  seg: {
    flex: 1, minHeight: CTRL.sm, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  segOn: { borderColor: C.primary, backgroundColor: C.primary },
  segTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.muted2 },
  segTxtOn: { color: '#fff' },

  list: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    overflow: 'hidden', ...cardShadow,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },
  rowMain: { flex: 1, minWidth: 0, minHeight: 66, paddingLeft: 14, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },

  av: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avMgr: { backgroundColor: C.primary },
  avInsp: { backgroundColor: C.chipBlue },
  avSusp: { backgroundColor: C.border2 },
  avTxt: { fontFamily: F.sansBold, fontSize: 14, letterSpacing: 0.3 },

  name: { flexShrink: 1, fontFamily: F.sansSemi, fontSize: 16, color: C.ink },
  youChip: {
    fontFamily: F.monoSemi, fontSize: 9.5, color: C.primary, backgroundColor: C.chipBlue,
    paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, overflow: 'hidden',
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  status: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },

  chip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  chipMgr: { backgroundColor: C.chipBlue },
  chipInsp: { backgroundColor: C.hair },
  chipSusp: { backgroundColor: C.hair },
  chipTxt: { fontFamily: F.sansSemi, fontSize: 10.5, letterSpacing: 0.2 },

  dots: { width: 44, height: 66, alignItems: 'center', justifyContent: 'center' },

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

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,33,38,0.34)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 26, gap: 14,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 999, backgroundColor: C.border2, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetTitle: { flex: 1, minWidth: 0, fontFamily: F.sansBold, fontSize: 19, color: C.ink },
  sheetX: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.hair },
  sheetBody: { fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.muted },

  fieldLabel: { fontFamily: F.sansSemi, fontSize: 11, letterSpacing: 0.5, color: C.muted, textTransform: 'uppercase' },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: C.border3, borderRadius: 12, paddingHorizontal: 13,
    fontFamily: F.sans, fontSize: 15, color: C.ink, backgroundColor: C.card,
  },

  primaryBtn: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },

  suspendBtn: {
    minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  suspendTxt: { fontFamily: F.sansSemi, fontSize: 15, color: C.amber },

  deleteBtn: {
    minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: C.dangerBg,
  },
  deleteTxt: { fontFamily: F.sansSemi, fontSize: 15, color: C.danger },

  selfNote: { fontFamily: F.monoMed, fontSize: 12, color: C.muted3, textAlign: 'center' },
});
