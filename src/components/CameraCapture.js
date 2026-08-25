import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Icon from './Icon';
import { C, F } from '../theme';

// Full-screen capture overlay. Mounted only while `state.camera` is set, so the
// camera hardware is released the moment the shot is filed or cancelled.
export default function CameraCapture() {
  const s = useStore();
  const cam = s.state.camera;
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const camRef = useRef(null);
  const insets = useSafeAreaInsets();

  const title = cam && cam.mode === 'defect' ? 'Defect photo'
    : cam && cam.mode === 'doc' ? 'Document photo'
    : (cam && cam.angle) || 'Photo';
  const close = () => s.closeCamera();

  const take = async () => {
    if (!camRef.current || busy || !ready) return;
    setBusy(true);
    try {
      // skipProcessing is left off deliberately — it skips the orientation fix on Android.
      const pic = await camRef.current.takePictureAsync({ quality: 0.6 });
      if (pic && pic.uri) setShot(pic.uri);
      else s.say('The camera returned no image. Try again.');
    } catch (e) {
      s.say('Could not take the photo. Try again.');
    }
    setBusy(false);
  };

  const body = () => {
    // Permission state still resolving.
    if (!perm) return <Centered><ActivityIndicator color="#fff" /></Centered>;

    if (!perm.granted) {
      return (
        <Centered>
          <View style={styles.permCard}>
            <Icon name="camera" size={30} color={C.primary} width={1.6} />
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permBody}>
              Full inspection photos are taken in the app so they stay attached to the vehicle record.
            </Text>
            {perm.canAskAgain ? (
              <Pressable onPress={requestPerm} style={styles.permBtn} accessibilityRole="button">
                <Text style={styles.permBtnTxt}>Allow camera</Text>
              </Pressable>
            ) : (
              <Text style={styles.permHint}>
                Camera is turned off for this app. Enable it in your device Settings, then try again.
              </Text>
            )}
            <Pressable onPress={close} style={styles.permCancel} accessibilityRole="button">
              <Text style={styles.permCancelTxt}>Not now</Text>
            </Pressable>
          </View>
        </Centered>
      );
    }

    // Confirm step — the inspector sees the frame before it is filed.
    if (shot) {
      return (
        <>
          <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          <View style={[styles.controls, { paddingBottom: Math.max(18, insets.bottom) }]}>
            <Pressable onPress={() => setShot(null)} style={styles.ghostBtn} accessibilityRole="button">
              <Icon name="refresh" size={18} color="#fff" width={1.9} />
              <Text style={styles.ghostTxt}>Retake</Text>
            </Pressable>
            <Pressable onPress={() => s.savePhoto(shot)} style={styles.useBtn} accessibilityRole="button">
              <Icon name="check" size={19} color="#fff" width={2.4} />
              <Text style={styles.useTxt}>Use photo</Text>
            </Pressable>
          </View>
        </>
      );
    }

    return (
      <>
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setReady(true)}
        />
        <View style={[styles.controls, { paddingBottom: Math.max(18, insets.bottom) }]}>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.round}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
          >
            <Icon name="flip" size={22} color="#fff" width={1.9} />
          </Pressable>

          <Pressable
            onPress={take}
            disabled={!ready || busy}
            style={[styles.shutter, (!ready || busy) && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel={'Take ' + title + ' photo'}
          >
            <View style={styles.shutterInner}>{busy ? <ActivityIndicator color={C.ink} /> : null}</View>
          </Pressable>

          <View style={styles.round} />
        </View>
      </>
    );
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        {body()}
        <View style={[styles.topBar, { paddingTop: Math.max(10, insets.top) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          </View>
          <Pressable onPress={close} style={styles.round} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close camera">
            <Icon name="x" size={18} color="#fff" width={2.2} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const Centered = ({ children }) => (
  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>{children}</View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: 'rgba(27,33,38,.55)',
  },
  topTitle: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },

  controls: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 18, gap: 12,
    backgroundColor: 'rgba(27,33,38,.55)',
  },
  round: {
    width: 48, height: 48, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  shutter: {
    width: 74, height: 74, borderRadius: 999, borderWidth: 3.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 58, height: 58, borderRadius: 999, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  ghostBtn: {
    flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.5)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ghostTxt: { fontFamily: F.sansSemi, fontSize: 15, color: '#fff' },
  useBtn: {
    flex: 1.4, minHeight: 52, borderRadius: 14, backgroundColor: C.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  useTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },

  permCard: { backgroundColor: C.card, borderRadius: 18, padding: 20, gap: 10, alignItems: 'center', width: '100%', maxWidth: 340 },
  permTitle: { fontFamily: F.sansBold, fontSize: 18, color: C.ink },
  permBody: { fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: C.muted, textAlign: 'center' },
  permHint: { fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.amber, textAlign: 'center' },
  permBtn: { alignSelf: 'stretch', minHeight: 50, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  permBtnTxt: { fontFamily: F.sansSemi, fontSize: 16, color: '#fff' },
  permCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  permCancelTxt: { fontFamily: F.sansSemi, fontSize: 14, color: C.muted },
});
