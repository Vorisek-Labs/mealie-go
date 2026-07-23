import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/mealieApi';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeFood, RecipeSuggestion, RecipeTool } from '../types';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'RecipeSuggestions'>;
};

function Picker({
  label, searchPlaceholder, options, selected, onToggle,
}: {
  label: string;
  searchPlaceholder: string;
  options: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? options.filter(o => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>{label}</Text>
      <TextInput
        style={pickerStyles.search}
        placeholder={searchPlaceholder}
        placeholderTextColor={colors.textDisabled}
        value={search}
        onChangeText={setSearch}
      />
      <View style={pickerStyles.chipRow}>
        {filtered.slice(0, 60).map(opt => {
          const active = selected.has(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[pickerStyles.chip, active && pickerStyles.chipActive]}
              onPress={() => onToggle(opt.id)}
            >
              <Text style={[pickerStyles.chipText, active && pickerStyles.chipTextActive]}>
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && (
          <Text style={pickerStyles.emptyText}>{t('suggestions.noMatches')}</Text>
        )}
      </View>
    </View>
  );
}

export default function RecipeSuggestionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [foods, setFoods] = useState<RecipeFood[]>([]);
  const [tools, setTools] = useState<RecipeTool[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [selectedFoods, setSelectedFoods] = useState<Set<string>>(new Set());
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  const [results, setResults] = useState<RecipeSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      setOptionsLoading(true);
      try {
        const [foodData, toolData] = await Promise.all([
          api.getFoods().catch(() => ({ items: [] })),
          api.getTools().catch(() => ({ items: [] })),
        ]);
        setFoods(foodData.items);
        setTools(toolData.items);
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  const toggleFood = (id: string) => setSelectedFoods(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleTool = (id: string) => setSelectedTools(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleFindRecipes = async () => {
    setSearching(true);
    try {
      const data = await api.getRecipeSuggestions({
        foods: [...selectedFoods],
        tools: [...selectedTools],
      });
      setResults(data.items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectionCount = selectedFoods.size + selectedTools.size;

  const handleClearAll = () => {
    setSelectedFoods(new Set());
    setSelectedTools(new Set());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('suggestions.title')}</Text>
        {!results && selectionCount > 0 ? (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAll}>{t('suggestions.clearAll')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {optionsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : results ? (
        <>
          <TouchableOpacity style={styles.backToPicker} onPress={() => setResults(null)}>
            <Text style={styles.backToPickerText}>{t('suggestions.changeIngredients')}</Text>
          </TouchableOpacity>
          {results.length === 0 ? (
            <EmptyState icon="🥕" title={t('suggestions.emptyResultsTitle')} subtitle={t('suggestions.emptyResultsSubtitle')} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.recipe.id}
              contentContainerStyle={styles.resultsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultCard}
                  onPress={() => navigation.navigate('RecipeDetail', { slug: item.recipe.slug, name: item.recipe.name })}
                >
                  <Text style={styles.resultName}>{item.recipe.name}</Text>
                  {item.missingFoods.length === 0 && item.missingTools.length === 0 ? (
                    <Text style={styles.haveEverything}>{t('suggestions.haveEverything')}</Text>
                  ) : (
                    <Text style={styles.missingText}>
                      {t('suggestions.missingLabel', {
                        items: [...item.missingFoods.map(f => f.name), ...item.missingTools.map(tool => tool.name)].join(', '),
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.intro}>
              {t('suggestions.intro')}
            </Text>
            <Picker
              label={t('suggestions.ingredientsLabel')}
              searchPlaceholder={t('suggestions.ingredientsSearchPlaceholder')}
              options={foods.filter((f): f is RecipeFood & { id: string } => !!f.id)}
              selected={selectedFoods}
              onToggle={toggleFood}
            />
            <Picker
              label={t('suggestions.toolsLabel')}
              searchPlaceholder={t('suggestions.toolsSearchPlaceholder')}
              options={tools.filter((tool): tool is RecipeTool & { id: string } => !!tool.id)}
              selected={selectedTools}
              onToggle={toggleTool}
            />
          </ScrollView>
          <TouchableOpacity
            style={[
              styles.findBtn,
              { bottom: spacing.lg + insets.bottom },
              (selectionCount === 0 || searching) && { opacity: 0.5 },
            ]}
            onPress={handleFindRecipes}
            disabled={selectionCount === 0 || searching}
          >
            {searching
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={styles.findBtnText}>
                  {selectionCount > 0
                    ? t('suggestions.findRecipesWithCount', { count: selectionCount })
                    : t('suggestions.findRecipes')}
                </Text>
            }
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: { gap: spacing.sm, marginBottom: spacing.lg },
  label: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.textDisabled, textTransform: 'uppercase', letterSpacing: 1,
  },
  search: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: typography.size.sm, color: colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.textInverse },
  emptyText: { color: colors.textDisabled, fontSize: typography.size.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  back: { fontSize: 28, color: colors.textSecondary, width: 32 },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  clearAll: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.medium, width: 70, textAlign: 'right' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  intro: { fontSize: typography.size.sm, color: colors.textSecondary, lineHeight: typography.size.sm * 1.5, marginBottom: spacing.lg },
  findBtn: {
    position: 'absolute', bottom: spacing.lg, left: spacing.md, right: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  findBtnText: { color: colors.textInverse, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
  backToPicker: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  backToPickerText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  resultsList: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.xs, marginBottom: spacing.sm,
  },
  resultName: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.textPrimary },
  haveEverything: { fontSize: typography.size.sm, color: colors.success },
  missingText: { fontSize: typography.size.sm, color: colors.textSecondary },
});
