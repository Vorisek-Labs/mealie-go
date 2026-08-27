import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import { nextSort, SORT_OPTIONS } from '../lib/recipeSort';
import type { RecipeSort } from '../lib/recipeSort';

interface Props {
  visible: boolean;
  sort: RecipeSort;
  onApply: (sort: RecipeSort) => void;
  onClose: () => void;
}

export default function RecipeSortModal({ visible, sort, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const select = (key: RecipeSort['key']) => {
    onApply(nextSort(sort, key));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        {/* This sheet sits flush against the physical screen bottom under
            edge-to-edge, so it needs the safe-area inset added by hand — normal
            flex layout has no concept of it. See CLAUDE.md. */}
        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('recipes.sort.title')}</Text>
          <Text style={styles.hint}>{t('recipes.sort.hint')}</Text>

          {SORT_OPTIONS.map(option => {
            const active = sort.key === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => select(option.key)}
              >
                <Text style={styles.rowIcon}>{option.icon}</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                    {t(`recipes.sort.${option.key}.label`)}
                  </Text>
                  {active && (
                    <Text style={styles.rowDirection}>
                      {t(`recipes.sort.${option.key}.${sort.direction}`)}
                    </Text>
                  )}
                </View>
                {active && (
                  <Text style={styles.rowArrow}>{sort.direction === 'asc' ? '↑' : '↓'}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderColor: colors.border,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.md,
  },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  hint: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    borderRadius: radius.md, marginTop: spacing.xs,
  },
  rowActive: { backgroundColor: colors.surfaceElevated },
  rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: typography.size.md, color: colors.textPrimary, fontWeight: typography.weight.medium },
  rowLabelActive: { color: colors.primary },
  rowDirection: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  rowArrow: { fontSize: 18, color: colors.primary, fontWeight: typography.weight.bold },
  closeBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  closeBtnText: { fontSize: typography.size.md, color: colors.textSecondary, fontWeight: typography.weight.medium },
});
