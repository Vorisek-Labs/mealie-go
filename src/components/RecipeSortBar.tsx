import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../theme';
import RecipeSortModal from './RecipeSortModal';
import { DEFAULT_SORT, sortOption } from '../lib/recipeSort';
import type { RecipeSort } from '../lib/recipeSort';

interface Props {
  sort: RecipeSort;
  onApply: (sort: RecipeSort) => void;
  // Number of recipes matching the current search/filters. `undefined` while a
  // fetch is in flight, so a stale count isn't shown next to fresh filters.
  count?: number;
}

// A chip rather than another icon button in the screen header: the header
// already carries five 36px buttons, which is about as much as a 360dp-wide
// phone fits, and a bare sort icon wouldn't show which order is actually
// active. This shows the current sort and opens the picker.
export default function RecipeSortBar({ sort, onApply, count }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isDefault = sort.key === DEFAULT_SORT.key && sort.direction === DEFAULT_SORT.direction;

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={[styles.chip, !isDefault && styles.chipActive]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.icon, !isDefault && styles.textActive]}>⇅</Text>
        <Text style={[styles.text, !isDefault && styles.textActive]} numberOfLines={1}>
          {t(`recipes.sort.${sort.key}.${sort.direction}`)}
        </Text>
        <Text style={[styles.icon, !isDefault && styles.textActive]}>
          {sortOption(sort.key).icon}
        </Text>
      </TouchableOpacity>

      {count !== undefined && (
        <Text style={styles.count}>{t('recipes.count', { count })}</Text>
      )}

      <RecipeSortModal
        visible={open}
        sort={sort}
        onApply={onApply}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  count: { fontSize: typography.size.sm, color: colors.textSecondary },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary },
  icon: { fontSize: 13, color: colors.textSecondary },
  text: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  textActive: { color: colors.primary },
});
