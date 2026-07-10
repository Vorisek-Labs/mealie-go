import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../theme';
import type { GuideSection } from '../navigation/navigateToGuide';
import type { RootStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParams, 'Guide'>;
};

interface Section {
  id: GuideSection;
  icon: string;
  title: string;
  tips: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'recipes',
    icon: '🍽️',
    title: 'Recipes',
    tips: [
      'Search recipes, or tap ▤ to filter by category, tag, tool, or ingredient.',
      'Tap ♡ on a recipe to favorite it — tap the ♡/♥ button at the top of the list to see favorites only.',
      'Tap 🎲 to jump to a random recipe.',
      'Tap 🥕 to open "What Can I Make?" — pick the ingredients and tools you have on hand, and it suggests recipes you can make, flagging anything you\'re still missing.',
      'Add a recipe with the + button: paste a URL to import it, or type one in by hand.',
      'On a recipe, you can scale servings, switch ingredient units to Metric, rate it, and leave comments.',
      'Tap "Add Ingredients to Shopping List" on a recipe to send its ingredients straight to one of your lists.',
      'Tap the camera icon on a recipe photo to replace it, and add files under Attachments.',
      'Share creates a link anyone can open — even without a Mealie account.',
      'Export turns a recipe into a PDF you can print or send.',
    ],
  },
  {
    id: 'mealPlan',
    icon: '📅',
    title: 'Meal Plan',
    tips: [
      'Use the ‹ › arrows to move between weeks, and tap a day to see what\'s planned.',
      'Tap + on Breakfast, Lunch, Dinner, or Side to add a recipe or a quick text note.',
      '"Surprise Me" picks a random recipe from your collection for you.',
      'Tap ✕ on any entry to remove it from the plan.',
    ],
  },
  {
    id: 'shopping',
    icon: '🛒',
    title: 'Shopping Lists',
    tips: [
      'Create as many lists as you like with the + button.',
      'Add items by typing them in, or send a recipe\'s ingredients straight to a list from that recipe\'s screen.',
      '"🍽 From Recipes" on a list lets you search and select several recipes at once — it adds all of their ingredients to the list in one go.',
      '"🗓 From Meal Plan" adds ingredients for everything planned in the current week automatically.',
      'Tap an item to check it off — checked items move to the bottom of the list.',
      'Long-press a list to delete it.',
    ],
  },
  {
    id: 'cookbooks',
    icon: '📖',
    title: 'Cookbooks',
    tips: [
      'Cookbooks group recipes together. Create one with + and give it a name and description.',
      'Long-press a cookbook to edit or delete it.',
      'Mark a cookbook Public to make it viewable without an account.',
      'Inside a cookbook you get the same search, filters, and 🎲 random button as the main Recipes list — handy for narrowing down a big cookbook.',
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: 'Settings',
    tips: [
      'Switch how ingredient amounts are shown between "As Written" and "Metric".',
      'Check which server, group, and household you\'re currently connected to.',
      'Sign out here to connect to a different Mealie server.',
    ],
  },
];

export default function GuideScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<RootStackParams, 'Guide'>>();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  useEffect(() => {
    const section = route.params?.section;
    if (!section) return;
    const timer = setTimeout(() => {
      const y = offsets.current[section];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [route.params?.section]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Guide</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          A quick reminder of what Mealie Go can do — jump to a section, or scroll through the whole thing.
        </Text>
        {SECTIONS.map(section => (
          <View
            key={section.id}
            style={styles.section}
            onLayout={e => { offsets.current[section.id] = e.nativeEvent.layout.y; }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{section.icon}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.bullet} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  close: { fontSize: typography.size.md, color: colors.primary, fontWeight: typography.weight.medium },
  scroll: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  intro: { fontSize: typography.size.sm, color: colors.textSecondary, lineHeight: typography.size.sm * 1.5 },
  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { fontSize: 22 },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 },
  tipText: { flex: 1, fontSize: typography.size.sm, color: colors.textSecondary, lineHeight: typography.size.sm * 1.5 },
});
