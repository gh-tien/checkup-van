import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { C, F } from '../theme';

export default function DrawOverlay() {
  const s = useStore();
  const st = s.state;
  const insets = useSafeAreaInsets();
  const settled = st.drawSettled;
  const van = st.drawPlate ? st.fleet.find((v) => v.plate === st.drawPlate) : null;

  const cap = parseInt(st.rerolls, 10) || 0;
  const rerollsLeft = Math.max(0, cap - (st.drawRerolls || 0));

  return (
    <LinearGradient
      colors={[C.primaryDeep, C.ink]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.fill, { paddingTop: 40 + insets.top, paddingBottom: 30 + insets.bottom }]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => s.closeDraw()} accessibilityRole="button" accessibilityLabel="Cancel the draw" style={styles.closeBtn}>
          <Icon name="x" size={16} color="#fff" width={2.2} />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {!settled ? (
          <>
            <Text style={styles.spinTitle}>Picking a vehicle{'\n'}from the pool…</Text>
            <View style={styles.spinBox}>
              <Text style={styles.spinPlate}>{st.drawSpinPlate}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>YOU'RE CHECKING</Text>
            <View style={styles.settleBox}>
              <Text style={styles.settlePlate}>{st.drawPlate}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 7 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 20, color: '#fff', textAlign: 'center' }}>{van ? van.model : ''}</Text>
              {van && van.jobs && van.jobs.length ? (
                <Text style={styles.statusPill(C.danger, C.dangerBg)}>{van.jobs.length} OPEN DEFECT{van.jobs.length === 1 ? '' : 'S'}</Text>
              ) : (
                <Text style={styles.statusPill(C.green, C.greenBg)}>NO OPEN DEFECTS</Text>
              )}
              <Text style={styles.settleSub}>{van ? (van.last === 0 ? 'Checked today' : `Last checked ${van.last} day${van.last === 1 ? '' : 's'} ago`) : ''}</Text>
              <Text style={styles.settleSub}>{van && van.driver && van.driver !== 'Unassigned' ? `Driver · ${van.driver}` : 'No driver on file'}</Text>
            </View>
          </>
        )}
      </View>

      {settled ? (
        <View style={{ gap: 11 }}>
          <Pressable onPress={() => s.confirmDraw()} accessibilityRole="button" accessibilityLabel={`Start the check on ${st.drawPlate}`} style={styles.startBtn}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 16, color: C.primaryDeep }}>Start check</Text>
          </Pressable>
          <Pressable onPress={() => s.redraw()} accessibilityRole="button" accessibilityLabel={cap === 0 ? 'No re-rolls allowed' : rerollsLeft ? `Draw a different vehicle again, ${rerollsLeft} left` : 'No re-rolls left'} style={styles.rerollBtn}>
            <Icon name="refresh" size={17} color={rerollsLeft ? '#fff' : 'rgba(255,255,255,.4)'} width={1.8} />
            <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: rerollsLeft ? '#fff' : 'rgba(255,255,255,.4)' }}>
              {cap === 0 ? 'No re-rolls allowed' : rerollsLeft ? `Again – ${rerollsLeft} Left` : 'No re-rolls left'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ height: 54 }} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, paddingHorizontal: 24 },
  closeBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' },
  spinTitle: { fontFamily: F.sansBold, fontSize: 22, lineHeight: 28, color: '#fff', textAlign: 'center' },
  spinBox: { width: 288, maxWidth: '82%', height: 78, borderRadius: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,.28)', backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  spinPlate: { fontFamily: F.monoBold, fontSize: 32, letterSpacing: 1.6, color: 'rgba(255,255,255,.9)' },
  eyebrow: { fontFamily: F.monoSemi, fontSize: 11, letterSpacing: 1.8, color: 'rgba(255,255,255,.55)' },
  settleBox: { width: 300, maxWidth: '84%', height: 88, borderRadius: 12, backgroundColor: C.draw, borderWidth: 2, borderColor: C.drawBorder, alignItems: 'center', justifyContent: 'center' },
  settlePlate: { fontFamily: F.monoBold, fontSize: 40, letterSpacing: 2.4, color: C.ink },
  settleSub: { fontFamily: F.sansMed, fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center' },
  statusPill: (fg, bg) => ({ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 0.4, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 7, backgroundColor: bg, color: fg, overflow: 'hidden' }),
  startBtn: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  rerollBtn: { minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.4)' },
});
