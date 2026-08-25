import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { plural } from '../format';
import { C, F, CTRL, cardShadow } from '../theme';

export default function DefectsScreen() {
  const s = useStore();
  const st = s.state;
  const q = (st.faultsQuery || '').trim().toLowerCase();

  const withJobs = st.fleet.filter((v) => s.hasJobs(v));
  const groups = withJobs.filter((v) => {
    if (!q) return true;
    return v.plate.toLowerCase().includes(q)
      || (v.model || '').toLowerCase().includes(q)
      || v.jobs.some((j) => j.toLowerCase().includes(q));
  });

  const totalOpen = st.fleet.reduce((n, v) => n + v.jobs.length, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
      <View style={styles.searchWrap}>
        <View style={styles.searchIcon} pointerEvents="none">
          <Icon name="search" size={17} color={C.muted3} width={1.9} />
        </View>
        <TextInput
          value={st.faultsQuery}
          onChangeText={(v) => s.onFaultsQuery(v)}
          placeholder="Search reg, model or defect"
          placeholderTextColor={C.muted3}
          accessibilityLabel="Search defects"
          autoCorrect={false}
          style={styles.search}
        />
        {!!q && (
          <Pressable onPress={() => s.clearFaultsQuery()} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear} hitSlop={6}>
            <Icon name="x" size={15} color={C.muted} width={2} />
          </Pressable>
        )}
      </View>

      <Text style={styles.count}>{totalOpen} open across {plural(withJobs.length, 'vehicle')}</Text>

      {groups.map((v) => {
        const open = !!st.faultOpen[v.plate];
        return (
          <View key={v.plate} style={styles.card}>
            <Pressable onPress={() => s.toggleFault(v.plate)} accessibilityRole="button" style={styles.head}>
              <View style={styles.dot} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.plate}>{v.plate}</Text>
                <Text style={styles.sub}>{v.model} · {plural(v.jobs.length, 'defect')}</Text>
              </View>
              <View style={open ? { transform: [{ rotate: '180deg' }] } : null}>
                <Icon name="chevronDown" size={16} color={C.faint} width={2} />
              </View>
            </Pressable>

            {open && (
              <View style={{ borderTopWidth: 1, borderTopColor: C.hair }}>
                {v.jobs.map((j) => (
                  <View key={j} style={styles.item}>
                    <Pressable onPress={() => s.goVan(v.plate)} accessibilityRole="button" style={styles.itemTxtWrap}>
                      <Text style={styles.itemTxt}>{j}</Text>
                    </Pressable>
                    <Pressable onPress={() => s.markFixed(v.plate, j)} accessibilityRole="button" style={styles.fixBtn}>
                      <Icon name="check" size={14} color={C.green} width={2.2} />
                      <Text style={styles.fixTxt}>Mark fixed</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => s.goVan(v.plate)} accessibilityRole="button" style={styles.openVan}>
                  <Text style={styles.openVanTxt}>Open vehicle record ›</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {withJobs.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTxt}>No open defects — all clear.</Text>
        </View>
      )}
      {withJobs.length > 0 && groups.length === 0 && (
        <Text style={styles.noMatch}>No defect matches “{st.faultsQuery}”.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  search: {
    minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card,
    paddingLeft: 36, paddingRight: 38, fontFamily: F.sans, fontSize: 15, color: C.ink,
  },
  clear: { position: 'absolute', right: 4, width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.muted },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden', ...cardShadow },
  head: { paddingVertical: 13, paddingHorizontal: 14, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.danger },
  plate: { fontFamily: F.sansSemi, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.sans, fontSize: 12, color: C.muted },

  item: { borderBottomWidth: 1, borderBottomColor: C.hair, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingRight: 12, paddingLeft: 34 },
  itemTxtWrap: { flex: 1, minWidth: 0, minHeight: 34, justifyContent: 'center', paddingVertical: 8 },
  itemTxt: { fontFamily: F.sans, fontSize: 14, lineHeight: 19, color: C.muted2 },
  fixBtn: { minHeight: CTRL.sm, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.greenBorder, backgroundColor: C.greenBg },
  fixTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.green },
  openVan: { backgroundColor: C.cardSubtle, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  openVanTxt: { fontFamily: F.sansSemi, fontSize: 12.5, color: C.primary },

  emptyCard: { borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.cardAlt, padding: 16 },
  emptyTxt: { fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted },
  noMatch: { paddingVertical: 26, paddingHorizontal: 14, textAlign: 'center', fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted },
});
