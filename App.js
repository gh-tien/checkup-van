import React, { useEffect, useState } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Fustat_400Regular, Fustat_500Medium, Fustat_600SemiBold, Fustat_700Bold,
} from '@expo-google-fonts/fustat';
import {
  IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';

import { StoreProvider, store, useStore } from './src/store';
import { C } from './src/theme';
import AppHeader from './src/components/AppHeader';
import BottomNav from './src/components/BottomNav';
import Toast from './src/components/Toast';
import CameraCapture from './src/components/CameraCapture';
import DriverSheet from './src/components/DriverSheet';
import ResetModal from './src/components/ResetModal';
import PersonSheet from './src/components/PersonSheet';
import GateScreen from './src/screens/GateScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CheckScreen from './src/screens/CheckScreen';
import DrawOverlay from './src/screens/DrawOverlay';
import FleetScreen from './src/screens/FleetScreen';
import VanScreen from './src/screens/VanScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';
import DefectsScreen from './src/screens/DefectsScreen';
import MoreScreen from './src/screens/MoreScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ConfigScreen from './src/screens/ConfigScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HelpScreen from './src/screens/HelpScreen';

function Shell() {
  const s = useStore();
  const st = s.state;

  // Android's physical/gesture Back was previously unhandled — mid-check it could drop the
  // user out of the app. Route it through the store's back-brain instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => s.hardwareBack());
    return () => sub.remove();
  }, [s]);

  if (st.signedOut) {
    return (
      <SafeAreaView style={styles.root} edges={['left', 'right']}>
        <GateScreen />
      </SafeAreaView>
    );
  }

  let body;
  if (st.screen === 'check') body = <CheckScreen />;
  else if (st.screen === 'checkhome') body = <DashboardScreen />;
  else if (st.screen === 'faults') body = <DefectsScreen />;
  else if (st.screen === 'vans') body = <FleetScreen />;
  else if (st.screen === 'van') body = <VanScreen />;
  else if (st.screen === 'approved') body = <ApprovalsScreen />;
  else if (st.screen === 'more') body = <MoreScreen />;
  // Reached from More rather than the tab bar; the header gives each one a back chevron.
  else if (st.screen === 'settings') body = <SettingsScreen />;
  else if (st.screen === 'config') body = <ConfigScreen />;
  else if (st.screen === 'people') body = <PeopleScreen />;
  else if (st.screen === 'profile') body = <ProfileScreen />;
  else if (st.screen === 'help') body = <HelpScreen />;
  else body = <DashboardScreen />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <AppHeader />
      <View style={{ flex: 1 }}>{body}</View>
      <BottomNav />
      <Toast />
      {st.drawOpen && <DrawOverlay />}
      {st.resetModal && <ResetModal />}
      {/* Add / manage a person — reachable from Personnel Management and from Profile's Manage pill. */}
      <PersonSheet />
      {/* Driver-confirm launch gate — pops over the launching screen; steps aside for the camera. */}
      {!!st.driverSheet && !st.camera && <DriverSheet />}
      {!!st.camera && <CameraCapture />}
    </SafeAreaView>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Fustat_400Regular, Fustat_500Medium, Fustat_600SemiBold, Fustat_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
  });

  useEffect(() => { store.hydrate().then(() => setReady(true)); }, []);

  if (!fontsLoaded || !ready) {
    return <View style={{ flex: 1, backgroundColor: C.appBg }} />;
  }

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.appBg },
});
