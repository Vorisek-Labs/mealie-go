import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { EMPTY_FILTERS } from '../hooks/useRecipes';
import type { RecipeFilters } from '../hooks/useRecipes';
import type { FilterOptionSets } from '../hooks/useRecipeFilterOptions';
import type { RecipeFood } from '../types';

type FilterKey = keyof RecipeFilters;

interface Props {
  visible: boolean;
  loading: boolean;
  options: FilterOptionSets;
  filters: RecipeFilters;
  onApply: (filters: RecipeFilters) => void;
  onClose: () => void;
}

export default function RecipeFilterModal({ visible, loading, options, filters, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<RecipeFilters>(filters);

  // Re-seed the draft from the live filters each time the modal opens, so a
  // cancel doesn't leave stale edits around for next time.
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);

  const toggleDraft = (key: FilterKey, value: string) =>
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
    }));

  const draftCount = draft.tags.length + draft.categories.length + draft.tools.length + draft.foods.length;

  const applyAndClose = () => {
    onApply(draft);
    onClose();
  };

  const clearAll = () => {
    setDraft(EMPTY_FILTERS);
    onApply(EMPTY_FILTERS);
    onClose();
  };

  const hasAnyOptions = options.tags.length > 0 || options.categories.length > 0
    || options.tools.length > 0 || options.foods.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Filter Recipes</Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clear}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <ChipSection
              label="CATEGORIES"
              options={options.categories.map(c => ({ value: c.slug, name: c.name }))}
              selected={draft.categories}
              onToggle={v => toggleDraft('categories', v)}
            />
            <ChipSection
              label="TAGS"
              options={options.tags.map(t => ({ value: t.slug, name: t.name }))}
              selected={draft.tags}
              onToggle={v => toggleDraft('tags', v)}
            />
            <ChipSection
              label="TOOLS"
              options={options.tools.map(t => ({ value: t.slug, name: t.name }))}
              selected={draft.tools}
              onToggle={v => toggleDraft('tools', v)}
            />
            <ChipSection
              label="FOODS"
              options={options.foods
                .filter((f): f is RecipeFood & { id: string } => !!f.id)
                .map(f => ({ value: f.id, name: f.name }))}
              selected={draft.foods}
              onToggle={v => toggleDraft('foods', v)}
            />

            {!loading && !hasAnyOptions && (
              <Text style={styles.emptyText}>No tags, categories, tools, or foods found on your server.</Text>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.applyBtn} onPress={applyAndClose}>
          <Text style={styles.applyBtnText}>
            Apply{draftCount > 0 ? ` (${draftCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ChipSection({ label, options, selected, onToggle }: {
  label: string;
  options: { value: string; name: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(opt => {
          const active = selected.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggle(opt.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: typography.size.md, color: colors.textSecondary, width: 60 },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  clear: { fontSize: typography.size.md, color: colors.error, width: 60, textAlign: 'right' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  sectionLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: typography.size.md, marginTop: spacing.xl },
  applyBtn: { position: 'absolute', bottom: spacing.xl, left: spacing.md, right: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center' },
  applyBtnText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textInverse },
});
