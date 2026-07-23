import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';

interface CookModeStep {
  title?: string;
  text: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  recipeName: string;
  steps: CookModeStep[];
  ingredientLines: { text: string; title?: string }[];
}

// Rendered only while `visible`, so the wake-lock (via useKeepAwake below)
// is held for exactly as long as Cook Mode is actually on screen and
// released the moment it unmounts.
function CookModeContent({ onClose, recipeName, steps, ingredientLines }: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const [stepIndex, setStepIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);

  const total = steps.length;
  const step = steps[stepIndex];
  const atStart = stepIndex === 0;
  const atEnd = stepIndex === total - 1;

  const goPrev = () => setStepIndex(i => Math.max(0, i - 1));
  const goNext = () => setStepIndex(i => Math.min(total - 1, i + 1));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.recipeName} numberOfLines={1}>{recipeName}</Text>
        {ingredientLines.length > 0 ? (
          <TouchableOpacity
            style={[styles.headerBtn, showIngredients && styles.headerBtnActive]}
            onPress={() => setShowIngredients(v => !v)}
          >
            <Text style={styles.headerBtnText}>📋</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerBtn} />}
      </View>

      {showIngredients ? (
        <ScrollView style={styles.ingredientsPanel} contentContainerStyle={styles.ingredientsPanelContent}>
          <Text style={styles.ingredientsPanelTitle}>{t('cookMode.ingredients')}</Text>
          {ingredientLines.map((line, i) => (
            <View key={i}>
              {line.title ? <Text style={styles.ingredientSectionTitle}>{line.title}</Text> : null}
              <View style={styles.ingredientRow}>
                <View style={styles.ingredientBullet} />
                <Text style={styles.ingredientText}>{line.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {total === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('cookMode.noSteps')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.stepCounter}>{t('cookMode.stepCounter', { current: stepIndex + 1, total })}</Text>
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepScrollContent}>
            {step.title ? <Text style={styles.stepTitle}>{step.title}</Text> : null}
            <Text style={styles.stepText}>{step.text}</Text>
          </ScrollView>

          <View style={[styles.navBar, { paddingBottom: spacing.md + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.navBtn, atStart && styles.navBtnDisabled]}
              onPress={goPrev}
              disabled={atStart}
            >
              <Text style={[styles.navBtnText, atStart && styles.navBtnTextDisabled]}>{t('cookMode.prev')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, atEnd && styles.navBtnDisabled]}
              onPress={goNext}
              disabled={atEnd}
            >
              <Text style={[styles.navBtnText, atEnd && styles.navBtnTextDisabled]}>{t('cookMode.next')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

export default function CookModeModal({ visible, onClose, recipeName, steps, ingredientLines }: Props) {
  // Reset back to step 1 each time Cook Mode is (re)opened.
  const [key, setKey] = useState(0);
  useEffect(() => { if (visible) setKey(k => k + 1); }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <CookModeContent
        key={key}
        onClose={onClose}
        recipeName={recipeName}
        steps={steps}
        ingredientLines={ingredientLines}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  headerBtnText: { fontSize: 16, color: colors.textPrimary },
  recipeName: { flex: 1, marginHorizontal: spacing.sm, textAlign: 'center', fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textSecondary },
  ingredientsPanel: { maxHeight: '35%', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  ingredientsPanelContent: { padding: spacing.md, gap: spacing.xs },
  ingredientsPanelTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  ingredientBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  ingredientText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary, lineHeight: typography.size.md * 1.4 },
  ingredientSectionTitle: {
    fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary,
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  stepCounter: {
    textAlign: 'center', fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 1,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  stepScroll: { flex: 1 },
  stepScrollContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'center' },
  stepTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary, textAlign: 'center' },
  stepText: { fontSize: typography.size.xl, color: colors.textPrimary, lineHeight: typography.size.xl * 1.5, textAlign: 'center' },
  navBar: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  navBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  navBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  navBtnText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textInverse },
  navBtnTextDisabled: { color: colors.textDisabled },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textDisabled, fontSize: typography.size.md, textAlign: 'center' },
});
