import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { filterOptionName } from '../hooks/useRecipeFilterOptions';
import type { FilterOptionSets } from '../hooks/useRecipeFilterOptions';
import type { RecipeFilters } from '../hooks/useRecipes';
import { timeBucketLabel } from '../lib/timeEstimate';

type FilterKey = keyof RecipeFilters;
type ListFilterKey = 'tags' | 'categories' | 'tools' | 'foods';
const KEYS: ListFilterKey[] = ['tags', 'categories', 'tools', 'foods'];

interface Props {
  filters: RecipeFilters;
  options: FilterOptionSets;
  onRemove: (key: FilterKey, value: string) => void;
}

export default function ActiveFilterChips({ filters, options, onRemove }: Props) {
  const count = filters.tags.length + filters.categories.length + filters.tools.length + filters.foods.length
    + (filters.maxPrepMinutes ? 1 : 0) + (filters.maxCookMinutes ? 1 : 0);
  if (count === 0) return null;

  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {filters.maxPrepMinutes ? (
          <TouchableOpacity
            style={styles.chip}
            onPress={() => onRemove('maxPrepMinutes', '')}
          >
            <Text style={styles.chipText}>Prep: {timeBucketLabel(filters.maxPrepMinutes)} ✕</Text>
          </TouchableOpacity>
        ) : null}
        {filters.maxCookMinutes ? (
          <TouchableOpacity
            style={styles.chip}
            onPress={() => onRemove('maxCookMinutes', '')}
          >
            <Text style={styles.chipText}>Cook: {timeBucketLabel(filters.maxCookMinutes)} ✕</Text>
          </TouchableOpacity>
        ) : null}
        {KEYS.flatMap(key =>
          filters[key].map(value => (
            <TouchableOpacity
              key={`${key}:${value}`}
              style={styles.chip}
              onPress={() => onRemove(key, value)}
            >
              <Text style={styles.chipText}>{filterOptionName(options, key, value)} ✕</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { marginBottom: spacing.xs },
  scroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { fontSize: typography.size.xs, color: colors.textInverse, fontWeight: typography.weight.medium },
});
