import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { PEOPLE, initials } from '../data/model';
import Icon from './Icon';
import { C, F } from '../theme';

const TITLES = {
  checkhome: 'Dashboard', faults: 'Defects', vans: 'Fleet', more: 'More', check: 'Full Inspection',
  settings: 'Settings', config: 'Depot configuration', people: 'People', help: 'How to & help',
};
// Screens reached from another screen rather than the tab bar: title only, plus a back chevron.
// Each one goes back the way it was opened, not to a fixed home.
const BACK_TO = {
  check: 'checkhome', van: 'vans',
  settings: 'more', config: 'settings', people: 'more', profile: 'people', help: 'more',
};

export default function AppHeader() {
  const s = useStore();
  const st = s.state;
  const back = BACK_TO[st.screen];
  const person = s.resolvedPerson();
  const ini = (st.people.find((x) => x.name === person) || PEOPLE[person] || {}).ini || initials(person);
  const title = st.screen === 'van' ? (st.vanId || 'Vehicle')
    : st.screen === 'approved' ? (s.isManager() ? 'Approvals' : 'My checks')
    // The profile header carries the person's own name — it is their record, not a section.
    : st.screen === 'profile' ? (st.viewPerson || 'Profile')
    : (TITLES[st.screen] || 'Dashboard');

  return (
    <View style={styles.bar}>
      {back ? (
        <Pressable onPress={() => s.navBack()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronRight" size={20} color={C.ink} width={2.2} />
        </Pressable>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 18, color: C.ink }}>{title}</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.muted }}>{st.depotName}</Text>
        </View>
      )}
      {!!back && <Text style={{ flex: 1, fontFamily: F.sansBold, fontSize: 18, color: C.ink }} numberOfLines={1}>{title}</Text>}
      <Pressable onPress={() => s.signOut('')} style={styles.avatar} hitSlop={6} accessibilityRole="button" accessibilityLabel={'Sign out ' + person}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: '#fff' }}>{ini}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '180deg' }] },
  avatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
