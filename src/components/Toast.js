import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { C, F } from '../theme';

export default function Toast() {
  const st = useStore().state;
  if (!st.toast) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.toast}><Text style={styles.text}>{st.toast}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 104, alignItems: 'center', zIndex: 80 },
  toast: { backgroundColor: C.ink, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 20, maxWidth: '88%' },
  text: { fontFamily: F.sansMed, fontSize: 13.5, color: '#fff', textAlign: 'center' },
});
