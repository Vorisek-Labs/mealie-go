import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import { EMPTY_FILTERS } from '../hooks/useRecipes';
import type { RecipeFilters } from '../hooks/useRecipes';
import type { FilterOptionSets } from '../hooks/useRecipeFilterOptions';
import { getTimeBuckets } from '../lib/timeEstimate';
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<RecipeFilters>(filters);

  // Re-seed the draft from the live filters each time the modal opens, so a
  // cancel doesn't leave stale edits around for next time.
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);

  const toggleDraft = (key: FilterKey, value: string) =>
    setDraft(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).includes(value)
        ? (prev[key] as string[]).filter(v => v !== value)
        : [...(prev[key] as string[]), value],
    }));

  // Single-select per field: tapping the active bucket again clears it.
  const selectPrepBucket = (value: number) =>
    setDraft(prev => ({ ...prev, maxPrepMinutes: prev.maxPrepMinutes === value ? undefined : value }));
  const selectCookBucket = (value: number) =>
    setDraft(prev => ({ ...prev, maxCookMinutes: prev.maxCookMinutes === value ? undefined : value }));

  const draftCount = draft.tags.length + draft.categories.length + draft.tools.length + draft.foods.length
    + (draft.maxPrepMinutes ? 1 : 0) + (draft.maxCookMinutes ? 1 : 0);

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
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('filterModal.title')}</Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clear}>{t('common.clearAll')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <ChipSection
              label={t('filterModal.categories')}
              options={options.categories.map(c => ({ value: c.slug, name: c.name }))}
              selected={draft.categories}
              onToggle={v => toggleDraft('categories', v)}
            />
            <TimeBucketSection
              label={t('filterModal.prepTime')}
              selected={draft.maxPrepMinutes}
              onSelect={selectPrepBucket}
            />
            <TimeBucketSection
              label={t('filterModal.cookTime')}
              selected={draft.maxCookMinutes}
              onSelect={selectCookBucket}
            />
            <ChipSection
              label={t('filterModal.tags')}
              options={options.tags.map(tag => ({ value: tag.slug, name: tag.name }))}
              selected={draft.tags}
              onToggle={v => toggleDraft('tags', v)}
            />
            <ChipSection
              label={t('filterModal.tools')}
              options={options.tools.map(tool => ({ value: tool.slug, name: tool.name }))}
              selected={draft.tools}
              onToggle={v => toggleDraft('tools', v)}
            />
            <ChipSection
              label={t('filterModal.foods')}
              options={options.foods
                .filter((f): f is RecipeFood & { id: string } => !!f.id)
                .map(f => ({ value: f.id, name: f.name }))}
              selected={draft.foods}
              onToggle={v => toggleDraft('foods', v)}
            />

            {!loading && !hasAnyOptions && (
              <Text style={styles.emptyText}>{t('filterModal.emptyOptions')}</Text>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={[styles.applyBtn, { bottom: spacing.xl + insets.bottom }]} onPress={applyAndClose}>
          <Text style={styles.applyBtnText}>
            {draftCount > 0 ? t('common.applyWithCount', { count: draftCount }) : t('common.apply')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function TimeBucketSection({ label, selected, onSelect }: {
  label: string;
  selected?: number;
  onSelect: (value: number) => void;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {getTimeBuckets().map(bucket => {
          const active = selected === bucket.value;
          return (
            <TouchableOpacity
              key={bucket.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(bucket.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {bucket.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// Above this many options a section switches to search-and-cap mode. Rendering
// every option was what made opening this modal slow: each chip is a real native
// view, and Mealie seeds THOUSANDS of foods, so the foods section alone could ask
// React Native to lay out several thousand views synchronously before the modal
// could appear. Nobody scrolls a 3,000-chip wall anyway — they search.
const CHIP_RENDER_CAP = 50;

function ChipSection({ label, options, selected, onToggle }: {
  label: string;
  options: { value: string; name: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const searchable = options.length > CHIP_RENDER_CAP;

  const { shown, matchCount } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = term
      ? options.filter(o => o.name.toLowerCase().includes(term))
      : options;
    // Selected options are always rendered, even when the current search text
    // excludes them — otherwise typing would appear to silently deselect things.
    const selectedSet = new Set(selected);
    const picked = options.filter(o => selectedSet.has(o.value));
    const rest = matches.filter(o => !selectedSet.has(o.value)).slice(0, CHIP_RENDER_CAP);
    return { shown: [...picked, ...rest], matchCount: matches.length };
  }, [options, selected, search]);

  if (options.length === 0) return null;

  const capped = matchCount > CHIP_RENDER_CAP;

  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      {searchable && (
        <TextInput
          style={styles.sectionSearch}
          placeholder={t('filterModal.searchPlaceholder')}
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      <View style={styles.chipRow}>
        {shown.map(opt => {
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
        {matchCount === 0 && (
          <Text style={styles.sectionHint}>{t('filterModal.noMatches')}</Text>
        )}
      </View>
      {/* Say so out loud rather than quietly showing a partial list. */}
      {capped && (
        <Text style={styles.sectionHint}>
          {t('filterModal.showingOf', { shown: CHIP_RENDER_CAP, total: matchCount })}
        </Text>
      )}
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
  sectionSearch: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2, marginBottom: spacing.sm,
    fontSize: typography.size.sm, color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: typography.size.xs, color: colors.textDisabled,
    marginTop: spacing.xs,
  },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: typography.size.md, marginTop: spacing.xl },
  applyBtn: { position: 'absolute', bottom: spacing.xl, left: spacing.md, right: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center' },
  applyBtnText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.textInverse },
});
