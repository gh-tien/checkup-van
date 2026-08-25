import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Switch, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';
import { plural } from '../format';

export default function ConfigScreen() {
  const s = useStore();
  const st = s.state;
  const bad = s.rulesBad();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Depot configuration</Text>
        <Pressable
          onPress={() => s.toggleAddValue()}
          accessibilityRole="button"
          accessibilityState={{ selected: st.showAddValue }}
          accessibilityLabel={st.showAddValue ? 'Turn editing off' : 'Edit configuration'}
          style={[styles.editToggle, st.showAddValue && styles.editToggleOn]}
        >
          <Icon name="pen" size={14} color={st.showAddValue ? '#fff' : C.primary} width={1.9} />
          <Text style={[styles.editToggleTxt, st.showAddValue && { color: '#fff' }]}>{st.showAddValue ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
      {/* The same toggle is also reachable by holding 550ms, or three taps inside 600ms. */}
      <Pressable
        onPressIn={() => s.holdStart()}
        onPressOut={() => s.holdEnd()}
        onPress={() => s.tapOpen()}
        style={{ gap: 12 }}
      >
        <Text style={styles.label}>Draw rules</Text>
        <View style={styles.pair}>
          <Field cap="Exclude if checked within (days)" value={st.excludeDays} onChange={(v) => s.setRule('excludeDays', v)} />
          <Field cap="Force any vehicle past (days)" value={st.forceDays} onChange={(v) => s.setRule('forceDays', v)} />
        </View>
        <View style={styles.pair}>
          <Field cap="Re-rolls per check" value={st.rerolls} onChange={(v) => s.setRule('rerolls', v)} />
          <Field cap="Target per week (checks)" value={st.target} onChange={(v) => s.setRule('target', v)} />
        </View>
        {bad && (
          <Text style={styles.bad}>
            The force-past number has to be larger than the exclusion window, or every vehicle is
            excluded and forced at the same time.
          </Text>
        )}

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Check photos</Text>
          <Text style={styles.count}>{plural(st.photoAngles.length, 'angle', 'angles')}</Text>
        </View>
        <View style={styles.card}>
          {st.photoAngles.map((a, i) => (
            <View key={a} style={[styles.angleRow, styles.hairline]}>
              <View style={styles.num}><Text style={styles.numTxt}>{i + 1}</Text></View>
              <Text style={styles.angleName} numberOfLines={1}>{a}</Text>
              <IconBtn name="arrowUp" label={'Move ' + a + ' up'} disabled={i === 0} onPress={() => s.moveAngle(i, -1)} />
              <IconBtn name="arrowDown" label={'Move ' + a + ' down'} disabled={i === st.photoAngles.length - 1} onPress={() => s.moveAngle(i, 1)} />
              <IconBtn name="trash" label={'Remove ' + a} color={C.danger} onPress={() => s.removeAngle(i)} />
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              value={st.angleNew}
              onChangeText={(v) => s.onAngleNew(v)}
              placeholder="Add an angle…"
              placeholderTextColor={C.muted3}
              accessibilityLabel="New angle"
              style={styles.addInput}
            />
            <Pressable onPress={() => s.addAngle()} accessibilityRole="button" style={styles.addBtn}>
              <Text style={styles.addBtnTxt}>Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Document types</Text>
          <Text style={styles.count}>{plural(st.docTypes.length, 'type', 'types')}</Text>
        </View>
        <View style={styles.card}>
          {st.docTypes.map((d, i) => (
            <View key={d.name} style={[styles.angleRow, styles.hairline]}>
              <Text style={styles.angleName} numberOfLines={1}>{d.name}</Text>
              <Text style={styles.count}>{plural(d.files, 'file', 'files')}</Text>
              <IconBtn name="trash" label={'Remove ' + d.name} color={C.danger} onPress={() => s.removeDocType(i)} />
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              value={st.docTypeNew}
              onChangeText={(v) => s.onDocTypeNew(v)}
              placeholder="Add a document type…"
              placeholderTextColor={C.muted3}
              accessibilityLabel="New document type"
              style={styles.addInput}
            />
            <TextInput
              value={st.docTypeFiles}
              onChangeText={(v) => s.onDocTypeFiles(v)}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="1"
              placeholderTextColor={C.muted3}
              accessibilityLabel="Files required"
              style={styles.filesInput}
            />
            <Pressable onPress={() => s.addDocType()} accessibilityRole="button" style={styles.addBtn}>
              <Text style={styles.addBtnTxt}>Add</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.hint}>Name is required. The number is how many files that type expects on upload.</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Vehicle use</Text>
          <Text style={styles.count}>{plural(st.vehicleUses.length, 'type', 'types')}</Text>
        </View>
        <View style={styles.card}>
          {st.vehicleUses.map((u, i) => (
            <View key={u} style={[styles.angleRow, styles.hairline]}>
              <Text style={styles.angleName} numberOfLines={1}>{u}</Text>
              <IconBtn name="trash" label={'Remove ' + u} color={C.danger} onPress={() => s.removeUse(i)} />
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              value={st.useNew}
              onChangeText={(v) => s.onUseNew(v)}
              placeholder="Add a use type… (e.g. PRV, BUS)"
              placeholderTextColor={C.muted3}
              autoCapitalize="characters"
              accessibilityLabel="New use type"
              style={styles.addInput}
            />
            <Pressable onPress={() => s.addUse()} accessibilityRole="button" style={styles.addBtn}>
              <Text style={styles.addBtnTxt}>Add</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.label, { paddingTop: 10 }]}>Fleet setup</Text>
        <Pressable
          onPress={() => s.say('Makes & models — coming in a later pass.')}
          accessibilityRole="button"
          style={styles.navRow}
        >
          <Icon name="truck" size={22} color={C.primary} width={1.7} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.navTitle}>Makes &amp; models</Text>
          </View>
          <Icon name="chevronRight" size={16} color={C.faint} width={2} />
        </Pressable>

        <Text style={[styles.label, { paddingTop: 10 }]}>Roles &amp; capabilities</Text>
        {st.configGroups.map((g) => (
          <Group key={g.role} group={g} />
        ))}
      </Pressable>
    </ScrollView>
  );
}

function Group({ group }) {
  const s = useStore();
  const st = s.state;
  const open = st.groupOpen === group.role;
  const onCount = group.caps.filter((c) => s.capOn(group.role, c.name)).length;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => s.toggleGroup(group.role)} accessibilityRole="button" style={styles.groupHead}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} color={C.faint} width={2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.groupRole}>{s.roleLabel(group.role)}</Text>
        </View>
        <Text style={styles.count}>{onCount + ' of ' + group.caps.length}</Text>
      </Pressable>

      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.hair }}>
          {group.caps.map((c, i) => {
            const editing = st.capEdit && st.capEdit.role === group.role && st.capEdit.idx === i;
            const on = s.capOn(group.role, c.name);
            return (
              <View key={c.name} style={[styles.capRow, styles.hairline]}>
                {editing ? (
                  <TextInput
                    value={st.capEdit.text}
                    onChangeText={(v) => s.onCapEdit(v)}
                    onBlur={() => s.saveCapEdit()}
                    autoFocus
                    accessibilityLabel="Edit capability"
                    style={styles.capInput}
                  />
                ) : (
                  <Pressable
                    onPress={() => (st.showAddValue ? s.startCapEdit(group.role, i, c.name) : null)}
                    disabled={!st.showAddValue}
                    accessibilityRole={st.showAddValue ? 'button' : undefined}
                    accessibilityLabel={st.showAddValue ? `Rename ${c.name}` : undefined}
                    style={{ flex: 1, minWidth: 0, gap: 2 }}
                  >
                    <Text style={[styles.capName, !on && { color: C.muted3 }]}>{c.name}</Text>
                    <Text style={styles.capDesc}>{c.desc}</Text>
                  </Pressable>
                )}
                <Switch
                  value={on}
                  onValueChange={() => s.toggleCap(group.role, c.name)}
                  trackColor={{ false: C.border3, true: C.primary }}
                  thumbColor="#fff"
                  accessibilityLabel={c.name}
                />
                {st.showAddValue && (c.seed ? (
                  <View style={styles.capIcon} accessibilityLabel="Ships with the app — can’t be removed">
                    <Icon name="lock" size={16} color={C.faint} width={1.9} />
                  </View>
                ) : (
                  <IconBtn name="trash" label={'Remove ' + c.name} color={C.danger} onPress={() => s.removeCap(group.role, i)} />
                ))}
              </View>
            );
          })}

          {st.showAddValue && (
            <View style={styles.addRow}>
              <TextInput
                value={(st.capNew || {})[group.role] || ''}
                onChangeText={(v) => s.onCapNew(group.role, v)}
                placeholder="Add a capability…"
                placeholderTextColor={C.muted3}
                accessibilityLabel={'New ' + group.role + ' capability'}
                style={styles.addInput}
              />
              <Pressable onPress={() => s.addCap(group.role)} accessibilityRole="button" style={styles.addBtn}>
                <Text style={styles.addBtnTxt}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Field({ cap, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldCap}>{cap}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={cap}
        style={styles.fieldInput}
      />
    </View>
  );
}

function IconBtn({ name, label, onPress, color = C.muted, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.capIcon, disabled && { opacity: 0.3 }]}
    >
      <Icon name={name} size={16} color={color} width={1.9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  screenTitle: { fontFamily: F.sansBold, fontSize: 18, color: C.ink },
  editToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: CTRL.sm, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.primary, backgroundColor: C.card },
  editToggleOn: { backgroundColor: C.primary },
  editToggleTxt: { fontFamily: F.sansSemi, fontSize: 13.5, color: C.primary },
  label: { fontFamily: F.sansSemi, fontSize: 12.5, lineHeight: 17, color: C.muted },
  bad: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 20, color: C.danger },
  count: { fontFamily: F.monoMed, fontSize: 11, color: C.muted3 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingTop: 10 },

  pair: { flexDirection: 'row', gap: 8 },
  field: {
    flex: 1, minWidth: 0, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minHeight: 56, justifyContent: 'center', gap: 2,
  },
  fieldCap: { fontFamily: F.sansMed, fontSize: 12, lineHeight: 16, color: C.muted },
  fieldInput: { fontFamily: F.sansMed, fontSize: 16, color: C.primary, padding: 0, minHeight: 24 },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    overflow: 'hidden', ...cardShadow,
  },
  hairline: { borderBottomWidth: 1, borderBottomColor: C.hair },

  angleRow: { paddingLeft: 14, paddingRight: 8, paddingVertical: 10, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6 },
  num: { width: 24, height: 24, borderRadius: 7, backgroundColor: C.border2, alignItems: 'center', justifyContent: 'center' },
  numTxt: { fontFamily: F.monoSemi, fontSize: 12, color: C.muted },
  angleName: { flex: 1, minWidth: 0, fontFamily: F.sansMed, fontSize: 15, color: C.ink },

  addRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: {
    flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: C.border3, borderRadius: 11,
    paddingHorizontal: 12, fontFamily: F.sans, fontSize: 15, color: C.ink,
  },
  addBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 11, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { fontFamily: F.sansSemi, fontSize: 14, color: '#fff' },
  filesInput: {
    width: 52, minHeight: 44, borderWidth: 1, borderColor: C.border3, borderRadius: 11,
    paddingHorizontal: 10, fontFamily: F.sansMed, fontSize: 15, color: C.ink, textAlign: 'center',
  },
  hint: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.muted3 },

  navRow: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 14, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, ...cardShadow,
  },
  navTitle: { fontFamily: F.sansMed, fontSize: 16, color: C.ink },

  groupHead: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupRole: { fontFamily: F.sansSemi, fontSize: 16, color: C.ink },

  capRow: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  capName: { fontFamily: F.sansMed, fontSize: 15, color: C.ink },
  capDesc: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 17, color: C.muted3 },
  capInput: {
    flex: 1, minWidth: 0, fontFamily: F.sansMed, fontSize: 15, color: C.ink,
    borderBottomWidth: 1, borderBottomColor: C.primary, paddingVertical: 4,
  },
  capIcon: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
