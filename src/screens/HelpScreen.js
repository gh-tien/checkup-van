import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useStore } from '../store';
import { HELP, APP_BUILD } from '../data/model';
import Icon from '../components/Icon';
import { C, F, cardShadow } from '../theme';

// The notes that used to sit on the working screens. One topic open at a time —
// `helpOpen` holds a single id, so opening one closes the last.
export default function HelpScreen() {
  const s = useStore();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
      <Text style={styles.intro}>
        The notes and instructions that used to sit on the working screens live here now. Tap a topic
        to read it; the screens themselves stay clear for the job.
      </Text>

      {HELP.map((group, gi) => (
        <React.Fragment key={group.label}>
          <Text style={[styles.section, gi > 0 && { paddingTop: 6 }]}>{group.label}</Text>
          {group.topics.map((t) => (
            <Topic key={t.id} topic={t} open={s.state.helpOpen === t.id} onPress={() => s.toggleHelp(t.id)} />
          ))}
        </React.Fragment>
      ))}

      <Text style={styles.footer}>These notes track the build — Vehicle Full Inspection {APP_BUILD}.</Text>
    </ScrollView>
  );
}

function Topic({ topic, open, onPress }) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.head}
      >
        <Icon name={topic.icon} size={22} color={C.primary} width={1.7} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.title}>{topic.title}</Text>
          <Text style={styles.sub}>{topic.sub}</Text>
        </View>
        <View style={open ? styles.chevOpen : null}>
          <Icon name="chevronDown" size={16} color={C.faint} width={2} />
        </View>
      </Pressable>

      {open && (
        <View style={styles.body}>
          {topic.body.map((para, i) => {
            const text = typeof para === 'string' ? para : para.text;
            const warn = typeof para !== 'string' && para.tone === 'warn';
            return (
              <Text key={i} style={[styles.para, warn && styles.paraWarn]}>{text}</Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.muted },
  section: { fontFamily: F.sansSemi, fontSize: 12.5, lineHeight: 17, color: C.muted },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    overflow: 'hidden', ...cardShadow,
  },
  head: { minHeight: 62, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: F.sansSemi, fontSize: 16, lineHeight: 21, color: C.ink },
  sub: { fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.muted },
  chevOpen: { transform: [{ rotate: '180deg' }] },

  body: {
    marginHorizontal: 14, paddingTop: 12, paddingBottom: 15, gap: 11,
    borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: C.border3,
  },
  para: { fontFamily: F.sans, fontSize: 14.5, lineHeight: 22, color: C.muted2 },
  paraWarn: { color: C.amber },

  footer: {
    fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: C.muted3,
    textAlign: 'center', paddingTop: 8, paddingBottom: 2,
  },
});
