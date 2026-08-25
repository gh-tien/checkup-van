import React from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useStore } from '../store';
import Icon from './Icon';
import { C, F, CTRL } from '../theme';

// Factory reset. Mounted from App.js so it can be raised from Settings and still sit above the
// header and the bottom nav. The reason is mandatory — a depot that has been emptied should be able
// to say why, and typing something is the pause that stops a mis-tap wiping the phone.
export default function ResetModal() {
  const s = useStore();
  const st = s.state;
  const meta = st.backupMeta;
  const ready = !!(st.resetReason || '').trim();

  return (
    <View style={styles.scrim}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => s.closeResetModal()}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView behavior="padding" style={styles.centre} pointerEvents="box-none">
        <View style={styles.dialog}>
          <Pressable
            onPress={() => s.closeResetModal()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={6}
            style={styles.x}
          >
            <Icon name="x" size={18} color={C.muted} width={2} />
          </Pressable>

          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={styles.badge}>
              <Icon name="alert" size={24} color={C.danger} width={1.8} />
            </View>
            <Text style={styles.title}>Factory reset?</Text>
            <Text style={styles.body}>
              This removes every vehicle, person, check and defect on this phone and restores the
              checklist template. It cannot be undone.
            </Text>
            {/* doReset() never touches the backup slot, so say which of the two situations you're in. */}
            <Text style={styles.body}>
              {meta
                ? 'The backup saved ' + meta.savedAt + ' stays on this phone — you could restore that '
                  + 'afterwards, but everything recorded since is gone.'
                : 'No backup has been saved, so there is no copy of this depot anywhere else.'}
            </Text>
          </View>

          <View style={{ gap: 5 }}>
            <Text style={styles.fieldCap}>Reason (required)</Text>
            <TextInput
              value={st.resetReason}
              onChangeText={(v) => s.onResetReason(v)}
              placeholder="Why are you erasing this depot?"
              placeholderTextColor={C.muted3}
              accessibilityLabel="Reason for factory reset"
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={() => s.doReset()}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            style={[styles.confirm, ready ? styles.confirmOn : styles.confirmOff]}
          >
            {/* C.muted2 rather than the prototype's lighter grey — on C.hair that clears AA, and the
                button is not truly inert (pressing it without a reason explains why). */}
            <Text style={[styles.confirmTxt, { color: ready ? '#fff' : C.disabledTxt }]}>Confirmed</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,33,38,0.34)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },

  dialog: {
    width: '100%', maxWidth: 340, backgroundColor: C.card, borderRadius: 18, padding: 20, gap: 12,
    shadowColor: C.ink, shadowOpacity: 0.34, shadowRadius: 26, shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  x: {
    position: 'absolute', top: 10, right: 10, zIndex: 1,
    width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },

  badge: { width: 48, height: 48, borderRadius: 999, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.sansBold, fontSize: 19, lineHeight: 24, color: C.ink, textAlign: 'center' },
  body: { fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted2, textAlign: 'center' },

  fieldCap: { fontFamily: F.sansMed, fontSize: 12, lineHeight: 16, color: C.muted },
  input: {
    minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12,
    fontFamily: F.sans, fontSize: 15, color: C.ink, backgroundColor: C.card,
  },

  confirm: { minHeight: CTRL.lg, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmOn: { backgroundColor: C.danger },
  confirmOff: { backgroundColor: C.disabledBg },
  confirmTxt: { fontFamily: F.sansSemi, fontSize: 16 },
});
