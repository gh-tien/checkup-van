import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { PEOPLE, initials } from '../data/model';
import Icon from '../components/Icon';
import { C, F, CTRL, cardShadow } from '../theme';

const DEV_PEOPLE = ['Tien Nguyen', 'Michael Pak', 'Phuog Lam', 'Ben Wang'];

function avatarColors(role) {
  if (role === 'Manager') return { bg: C.chipBlue, fg: C.primary };
  if (role === 'Admin') return { bg: C.ink, fg: '#fff' };
  return { bg: C.border2, fg: C.muted2 };
}

export default function GateScreen() {
  const s = useStore();
  const st = s.state;
  const insets = useSafeAreaInsets();

  const query = st.pickQuery.trim().toLowerCase();
  const roleOf = (name) => {
    const p = st.people.find((x) => x.name === name);
    return (p && p.role) || (PEOPLE[name] || {}).role || 'Inspector';
  };
  const results = query
    ? st.people.filter((p) => !p.suspended && p.name.toLowerCase().includes(query))
    : [];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 64 + insets.top, paddingBottom: 26 + insets.bottom, backgroundColor: C.card }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginVertical: 'auto', width: '100%' }}>
        {/* Brand mark */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={[styles.brand, cardShadow]}>
            <Icon name="check" size={28} color="#fff" width={2.8} />
          </View>
        </View>

        {!!st.lockReason && (
          <View style={styles.reasonPill}>
            <Text style={{ fontFamily: F.sansMed, fontSize: 13, color: C.amber }}>{st.lockReason}</Text>
          </View>
        )}

        {st.gatePhase === 'pick' ? (
          <View>
            {/* Search */}
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 14, zIndex: 1 }}>
                <Icon name="search" size={19} color={C.muted3} width={1.9} />
              </View>
              <TextInput
                value={st.pickQuery}
                onChangeText={(t) => s.onPickQuery(t)}
                placeholder="Search your name…"
                placeholderTextColor={C.muted3}
                autoCorrect={false}
                autoCapitalize="words"
                style={styles.searchInput}
              />
              {!!st.pickQuery && (
                <Pressable
                  onPress={() => s.clearPickQuery()}
                  accessibilityRole="button"
                  accessibilityLabel="Clear the search"
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Icon name="x" size={17} color={C.muted3} width={2} />
                </Pressable>
              )}
            </View>

            {/* Suggestions */}
            {!!query && (
              <View style={[styles.suggestBox, cardShadow]}>
                {results.length === 0 ? (
                  <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, padding: 16 }}>No match</Text>
                ) : results.map((p, i) => {
                  const col = avatarColors(p.role);
                  return (
                    <Pressable
                      key={p.name}
                      onPress={() => s.choosePerson(p.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign in as ${p.name}, ${p.role}`}
                      style={[styles.suggestRow, { borderBottomWidth: i === results.length - 1 ? 0 : 1 }]}
                    >
                      <View style={[styles.avatar36, { backgroundColor: col.bg }]}>
                        <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: col.fg }}>{p.ini || initials(p.name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.sansSemi, fontSize: 15.5, color: C.ink }}>{p.name}</Text>
                        <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.muted }}>{p.role}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Admin is a real route into the depot setup; the dev shortcuts below it are not, and
                were outweighing the one path a driver actually uses. Both are __DEV__ only now. */}
            <View style={{ marginTop: 16 }}>
              <Pressable
                onPress={() => s.goAdmin()}
                accessibilityRole="button"
                accessibilityLabel="Sign in as depot administrator"
                style={[styles.gateBtn, { borderColor: C.primary }]}
              >
                <Icon name="shield" size={17} color={C.primary} width={1.8} />
                <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.primary }}>Admin</Text>
              </Pressable>
            </View>

            {__DEV__ && (
              <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: C.border, borderStyle: 'dashed', paddingTop: 14, gap: 9 }}>
                <Text style={styles.devLabel}>Dev · quick sign-in</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                  {DEV_PEOPLE.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => s.choosePerson(name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dev quick sign-in as ${name}`}
                      style={styles.devChip}
                    >
                      <Text style={{ fontFamily: F.sansSemi, fontSize: 12, color: C.muted }}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => s.devSkip()}
                  accessibilityRole="button"
                  accessibilityLabel="Skip the PIN — development only"
                  style={[styles.gateBtn, { borderColor: C.border3, borderStyle: 'dashed' }]}
                >
                  <Icon name="bolt" size={17} color={C.muted} width={1.8} />
                  <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.muted }}>Skip PIN — dev</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <PinPad />
        )}
      </View>
    </ScrollView>
  );
}

function PinPad() {
  const s = useStore();
  const st = s.state;
  const name = st.pinPerson;
  const role = (st.people.find((x) => x.name === name) || PEOPLE[name] || {}).role || 'Inspector';
  const ini = (st.people.find((x) => x.name === name) || {}).ini || initials(name);
  const dots = [0, 1, 2, 3].map((i) => i < st.pinEntry.length);

  const Key = ({ d }) => (
    <Pressable
      onPress={() => s.pad(String(d))}
      accessibilityRole="button"
      accessibilityLabel={String(d)}
      style={[styles.key, cardShadow]}
    >
      <Text style={{ fontFamily: F.sansMed, fontSize: 26, color: C.ink }}>{d}</Text>
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.pinAvatar}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: '#fff' }}>{ini}</Text>
      </View>
      <Text style={{ fontFamily: F.sansBold, fontSize: 21, color: C.ink }}>{name}</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 13.5, color: C.muted, marginTop: 2 }}>{role}</Text>

      <View
        style={{ flexDirection: 'row', gap: 14, marginVertical: 22 }}
        accessibilityLabel={`${st.pinEntry.length} of 4 digits entered`}
      >
        {dots.map((on, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: on ? C.primary : 'transparent', borderWidth: 1.6, borderColor: on ? C.primary : C.faint }} />
        ))}
      </View>
      <Text style={{ height: 18, fontFamily: F.sansMed, fontSize: 13, color: C.danger }}>{st.pinError ? 'Wrong PIN — try again' : ''}</Text>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <Key key={d} d={d} />)}
        <View style={{ width: 72, height: 64 }} />
        <Key d={0} />
        <Pressable onPress={() => s.padBack()} accessibilityRole="button" accessibilityLabel="Delete the last digit" style={{ width: 72, height: 64, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="backspace" size={26} color={C.muted} width={1.8} />
        </Pressable>
      </View>

      {__DEV__ && (
        <>
          <Pressable
            onPress={() => s.devSkip()}
            accessibilityRole="button"
            accessibilityLabel="Skip the PIN — development only"
            style={[styles.gateBtn, { marginTop: 20, flex: 0, paddingHorizontal: 20, borderColor: C.border3, borderStyle: 'dashed' }]}
          >
            <Icon name="bolt" size={17} color={C.muted} width={1.8} />
            <Text style={{ fontFamily: F.sansMed, fontSize: 14, color: C.muted }}>Skip PIN — dev</Text>
          </Pressable>
          <Text style={{ fontFamily: F.mono, fontSize: 11.5, color: C.muted3, marginTop: 16 }}>Demo PIN 1234</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  reasonPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.amberBg },
  searchInput: { width: '100%', minHeight: CTRL.lg, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingLeft: 42, paddingRight: 40, fontFamily: F.sans, fontSize: 16, color: C.ink },
  suggestBox: { marginTop: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, minHeight: 58, borderBottomColor: C.hair },
  clearBtn: { position: 'absolute', right: 4, width: CTRL.sm, height: CTRL.sm, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatar36: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  devLabel: { fontFamily: F.monoSemi, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted3, textAlign: 'center' },
  devChip: { minHeight: CTRL.sm, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.border3, borderStyle: 'dashed' },
  gateBtn: { flex: 1, minHeight: CTRL.md, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  pinAvatar: { width: 66, height: 66, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  keypad: { width: 72 * 3 + 14 * 2, flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  key: { width: 72, height: 64, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
});
