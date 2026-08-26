import React from 'react';
import { View, Text, Pressable, TextInput, Switch, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from './Icon';
import { C, F, CTRL } from '../theme';

// Add / manage a person. Mounted at the app shell rather than inside Personnel Management, because
// Profile's "Manage" pill opens the same sheet from a different screen.
export default function PersonSheet() {
  const st = useStore().state;
  if (!st.peopleSheet) return null;
  return st.peopleSheet.mode === 'add' ? <AddSheet /> : <ManageSheet />;
}

function AddSheet() {
  const s = useStore();
  const st = s.state;
  const ready = !!(st.peopleNew || '').trim();

  return (
    <Scrim>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Add a person</Text>
        <CloseX />
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
          <ChoiceSeg label="Inspector" on={st.peopleNewRole === 'Inspector'} onPress={() => s.setNewRole('Inspector')} />
          <ChoiceSeg label="Manager" on={st.peopleNewRole === 'Manager'} onPress={() => s.setNewRole('Manager')} />
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
    </Scrim>
  );
}

// Who you are acting on sits in a compact context row at the top, then hairline-separated groups —
// role, then the two account actions. Nothing is centred, so the eye runs straight down one edge.
function ManageSheet() {
  const s = useStore();
  const st = s.state;
  const name = st.peopleSheet.name;
  const person = st.people.find((p) => p.name === name) || { name, suspended: false };
  const self = name === s.resolvedPerson();

  const eff = s.roleOf(name);
  const isAdminRole = eff === 'Admin';
  const base = s.baseRoleOf(eff);
  const canEditRole = s.isAdmin() && !self;
  const canGrantAdmin = canEditRole && base === 'Manager';
  const armed = st.peopleDelArm;

  return (
    <Scrim>
      <View style={styles.ctxRow}>
        <View style={styles.ctxAv}><Text style={styles.ctxAvTxt}>{person.ini || ''}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.ctxName} numberOfLines={1}>{name}</Text>
          <Text style={styles.ctxRole}>{s.roleLabel(eff)}</Text>
        </View>
        <CloseX />
      </View>

      {canEditRole && (
        <>
          <View style={styles.hair} />
          <View style={{ gap: 10 }}>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ChoiceSeg tall label="Inspector" on={base === 'Inspector'} onPress={() => s.setPersonRole(name, 'Inspector')} />
              <ChoiceSeg tall label="Manager" on={base === 'Manager'} onPress={() => s.setPersonRole(name, 'Manager')} />
            </View>

            {canGrantAdmin && (
              <View style={styles.adminRow}>
                <Text style={[styles.adminLabel, { color: isAdminRole ? C.ink : C.muted2 }]}>System admin access</Text>
                <Switch
                  value={isAdminRole}
                  onValueChange={() => s.togglePersonAdmin(name)}
                  trackColor={{ false: C.border3, true: C.primary }}
                  thumbColor="#fff"
                  accessibilityLabel={'System admin access for ' + name}
                />
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.hair} />

      <View style={{ gap: 10 }}>
        {/* Suspend is hidden on your own account, and delete is blocked there — you cannot lock
            yourself out of the depot from inside it. */}
        {!self && (
          <Pressable onPress={() => s.toggleSuspend(name)} accessibilityRole="button" style={styles.suspendBtn}>
            <Icon name="lock" size={19} color={C.amber} width={1.8} />
            <Text style={styles.suspendTxt}>{person.suspended ? 'Reinstate ' + name : 'Suspend ' + name}</Text>
          </Pressable>
        )}

        {!self && (
          <Pressable
            onPress={() => s.armDelete(name)}
            accessibilityRole="button"
            accessibilityLabel={armed ? 'Tap again to delete ' + name : 'Delete ' + name + ' from depot'}
            style={[styles.deleteBtn, { backgroundColor: armed ? C.danger : C.dangerBg }]}
          >
            <Icon name="trash" size={19} color={armed ? '#fff' : C.danger} width={1.9} />
            <Text style={[styles.deleteTxt, { color: armed ? '#fff' : C.danger }]}>
              {armed ? 'Tap again to delete ' + name : 'Delete from depot'}
            </Text>
          </Pressable>
        )}

        {self && <Text style={styles.selfNote}>You can’t delete your own account</Text>}
      </View>
    </Scrim>
  );
}

function Scrim({ children }) {
  const s = useStore();
  return (
    <View style={styles.scrim}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => s.closePeopleSheet()}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {children}
      </View>
    </View>
  );
}

function CloseX() {
  const s = useStore();
  return (
    <Pressable onPress={() => s.closePeopleSheet()} accessibilityRole="button" accessibilityLabel="Close" style={styles.sheetX}>
      <Icon name="x" size={15} color={C.muted2} width={2.2} />
    </Pressable>
  );
}

// A committing choice (which role to give someone) — filled, so it reads as a decision, not a filter.
export function ChoiceSeg({ label, on, onPress, tall }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.choiceSeg, tall && styles.choiceSegTall, on && styles.choiceSegOn]}
    >
      <Text style={[styles.choiceSegTxt, tall && styles.choiceSegTxtTall, on && styles.choiceSegTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,33,38,0.34)', justifyContent: 'flex-end', zIndex: 65 },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 26, gap: 16,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 999, backgroundColor: C.border2, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetTitle: { flex: 1, minWidth: 0, fontFamily: F.sansBold, fontSize: 19, color: C.ink },
  sheetX: { width: 34, height: 34, borderRadius: 999, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.hair },

  ctxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctxAv: { width: 46, height: 46, borderRadius: 999, flexShrink: 0, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  ctxAvTxt: { fontFamily: F.sansBold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },
  ctxName: { fontFamily: F.sansBold, fontSize: 18, color: C.ink },
  ctxRole: { fontFamily: F.sansBold, fontSize: 12.5, color: C.primary },

  hair: { height: 1, backgroundColor: C.hair },

  fieldLabel: { fontFamily: F.sansSemi, fontSize: 11, letterSpacing: 0.5, color: C.muted3, textTransform: 'uppercase' },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: C.border3, borderRadius: 12, paddingHorizontal: 13,
    fontFamily: F.sans, fontSize: 15, color: C.ink, backgroundColor: C.card,
  },

  choiceSeg: {
    flex: 1, minHeight: CTRL.sm, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  choiceSegTall: { minHeight: 50, borderRadius: 13 },
  choiceSegOn: { borderColor: C.primary, backgroundColor: C.primary },
  choiceSegTxt: { fontFamily: F.sansSemi, fontSize: 13, color: C.muted2 },
  choiceSegTxtTall: { fontSize: 14.5 },
  choiceSegTxtOn: { color: '#fff' },

  adminRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: CTRL.lg, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.cardSubtle,
  },
  adminLabel: { flex: 1, fontFamily: F.sansMed, fontSize: 15 },

  primaryBtn: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },

  suspendBtn: {
    minHeight: CTRL.lg, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  suspendTxt: { flex: 1, fontFamily: F.sansSemi, fontSize: 15.5, color: C.amber },

  deleteBtn: {
    minHeight: CTRL.lg, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 16,
  },
  deleteTxt: { flex: 1, fontFamily: F.sansSemi, fontSize: 15.5 },

  selfNote: { fontFamily: F.sans, fontSize: 12.5, color: C.muted3, textAlign: 'center', paddingTop: 2 },
});
