import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { plural } from '../format';
import Icon from '../components/Icon';
import { C, F, cardShadow } from '../theme';

export default function MoreScreen() {
  const s = useStore();
  const st = s.state;
  const admin = s.isAdmin();

  // Match what the People screen actually lists: the roster excludes Admins, and "active" is
  // only true when nobody is suspended.
  const roster = s.roster();
  const suspended = roster.filter((p) => p.suspended).length;
  const peopleSub = plural(roster.length, 'person', 'people')
    + (suspended ? ' · ' + plural(suspended, 'suspended', 'suspended') : ' · all active');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}>
      {admin && (
        <>
          <SectionLabel>Management</SectionLabel>
          <Row
            icon="listCheck"
            title="Templates"
            soon
          />
          <Row
            icon="users"
            title="People"
            sub={peopleSub}
            onPress={() => s.go('people')}
          />
        </>
      )}

      <SectionLabel spaced={admin}>Fleet</SectionLabel>
      <Row
        icon="truck"
        title="Fleet"
        sub={st.fleet.length + ' vehicles'}
        onPress={() => s.goVans('all')}
      />

      <SectionLabel spaced>Support</SectionLabel>
      <Row
        icon="help"
        title="How to & help"
        onPress={() => s.go('help')}
      />

      {admin && (
        <>
          <SectionLabel spaced>App</SectionLabel>
          <Row
            icon="gear"
            title="Settings"
            onPress={() => s.go('settings')}
          />
        </>
      )}
    </ScrollView>
  );
}

function SectionLabel({ children, spaced }) {
  return <Text style={[styles.section, spaced && { paddingTop: 10 }]}>{children}</Text>;
}

function Row({ icon, title, sub, onPress, soon }) {
  // A not-yet-built destination is shown, not hidden: the row reads as present-but-pending
  // rather than navigating into a dead end or firing a toast after the tap.
  const Wrap = soon ? View : Pressable;
  return (
    <Wrap
      {...(soon ? {} : { onPress, accessibilityRole: 'button' })}
      style={[styles.row, soon && styles.rowSoon]}
    >
      <Icon name={icon} size={23} color={soon ? C.muted3 : C.primary} width={1.7} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[styles.title, soon && { color: C.muted2 }]} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.sub}>{sub}</Text>}
      </View>
      {soon
        ? <View style={styles.soonPill}><Text style={styles.soonTxt}>Coming soon</Text></View>
        : <Icon name="chevronRight" size={16} color={C.faint} width={2} />}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: F.sansSemi, fontSize: 12.5, lineHeight: 17, color: C.muted },
  row: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 14, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 14,
    ...cardShadow,
  },
  rowSoon: { backgroundColor: C.cardSubtle },
  soonPill: { paddingHorizontal: 10, minHeight: 24, justifyContent: 'center', borderRadius: 999, backgroundColor: C.chipBlue },
  soonTxt: { fontFamily: F.monoSemi, fontSize: 10, letterSpacing: 0.4, color: C.primary, textTransform: 'uppercase' },
  title: { fontFamily: F.sansMed, fontSize: 16, color: C.ink },
  sub: { fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.muted },
});
