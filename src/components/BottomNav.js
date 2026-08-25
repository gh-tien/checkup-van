import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Icon from './Icon';
import { C, F } from '../theme';

// Screens that live under a tab: keep that tab lit so the deep screen still says where you are.
const CHILD_OF = { check: 'checkhome', van: 'vans', settings: 'more', config: 'more', people: 'more', profile: 'more', help: 'more' };

const TABS = [
  { key: 'checkhome', label: 'Dashboard', icon: 'speed' },
  { key: 'faults', label: 'Defects', icon: 'alert' },
  { key: 'vans', label: 'Fleet', icon: 'truck' },
  { key: 'approved', label: 'Approvals', icon: 'clipboard' },
  { key: 'more', label: 'More', icon: 'menu' },
];

export default function BottomNav() {
  const s = useStore();
  const st = s.state;
  const insets = useSafeAreaInsets();
  // The check is a full-screen commit flow: hiding the tab bar removes the one-tap path that
  // would silently discard an in-progress walk-around. Back (header chevron / Android Back)
  // is the deliberate way out.
  if (st.screen === 'check') return null;
  const badges = { approved: s.approvalsCount() };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(10, insets.bottom) }]}>
      {TABS.map((t) => {
        const active = st.screen === t.key || CHILD_OF[st.screen] === t.key;
        const color = active ? C.primary : C.muted;
        const badge = badges[t.key];
        return (
          <Pressable
            key={t.key}
            onPress={() => s.go(t.key)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View>
              <Icon name={t.icon} size={23} color={color} width={1.7} />
              {badge ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
              ) : null}
            </View>
            <Text style={{ fontFamily: active ? F.sansSemi : F.sansMed, fontSize: 11, color }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 6 },
  tab: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  badge: { position: 'absolute', top: -4, left: 14, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: F.monoSemi, fontSize: 10, color: '#fff' },
});
