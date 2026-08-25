import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F } from '../theme';

// Non-slice tabs (Defects / Fleet / Approvals / More) — coming in the next pass.
export default function Placeholder({ title }) {
  const s = useStore();
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}><Icon name="clipboardCheck" size={26} color={C.primary} width={1.6} /></View>
      <Text style={{ fontFamily: F.sansBold, fontSize: 19, color: C.ink }}>{title}</Text>
      <Pressable onPress={() => s.go('checkhome')} accessibilityRole="button" accessibilityLabel="Back to dashboard" style={styles.btn}>
        <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: '#fff' }}>Back to dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  badge: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.chipBlue, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, marginTop: 6 },
});
