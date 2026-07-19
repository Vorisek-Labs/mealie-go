import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
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

const SECTION_ICONS: Record<GuideSection, string> = {
  recipes: '🍽️',
  mealPlan: '📅',
  shopping: '🛒',
  cookbooks: '📖',
  settings: '⚙️',
};

export default function GuideScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParams, 'Guide'>>();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  // returnObjects: true is required to get the tips array back rather than
  // a stringified/joined version -- react-i18next otherwise assumes t()
  // always returns a string.
  const SECTIONS: Section[] = useMemo(
    () => (Object.keys(SECTION_ICONS) as GuideSection[]).map(id => ({
      id,
      icon: SECTION_ICONS[id],
      title: t(`guide.${id}.title`),
      tips: t(`guide.${id}.tips`, { returnObjects: true }) as string[],
    })),
    [t]
  );

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
        <Text style={styles.title}>{t('guide.headerTitle')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.close}>{t('guide.close')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {t('guide.intro')}
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
