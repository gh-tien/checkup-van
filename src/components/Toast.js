import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useStore } from '../store';
import { C, F } from '../theme';

// Enters from the top with a 0.30s ease-out slide + fade, matching the prototype's `toastIn`
// keyframe. It sits above the header on purpose: at the top the message is in the same place
// the user's eye already is after tapping a control, and it never covers the bottom nav.
export default function Toast() {
  const st = useStore().state;
  const anim = useRef(new Animated.Value(0)).current;
  const shown = !!st.toast;

  useEffect(() => {
    if (!shown) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [shown, st.toast, anim]);

  if (!shown) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}>
        <Text style={styles.text}>{st.toast}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 16, alignItems: 'center', zIndex: 80 },
  toast: { backgroundColor: C.ink, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 20, maxWidth: '88%' },
  text: { fontFamily: F.sansMed, fontSize: 13.5, color: '#fff', textAlign: 'center' },
});
