import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecipes } from '../hooks/useRecipes';
import { useRecipeFilterOptions } from '../hooks/useRecipeFilterOptions';
import type { RecipeFilters } from '../hooks/useRecipes';
import { api } from '../lib/mealieApi';
import { useFavorites } from '../context/FavoritesContext';
import RecipeCard from '../components/RecipeCard';
import RecipeFilterModal from '../components/RecipeFilterModal';
import ActiveFilterChips from '../components/ActiveFilterChips';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeSummary } from '../types';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'RecipesList'>;
};

type FilterKey = keyof RecipeFilters;

export default function RecipesScreen({ navigation }: Props) {
  const {
    recipes, loading, loadingMore, error, search, setSearch,
    refresh, loadMore, hasMore, filters, applyFilters, activeFilterCount,
  } = useRecipes();

  const { options, loading: filterLoading, ensureLoaded } = useRecipeFilterOptions();
  const { favoriteIds } = useFavorites();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [randomizing, setRandomizing] = useState(false);

  // "Favorites only" must search the whole server, not just the recipes
  // already paginated into `recipes` — otherwise favorites that haven't been
  // scrolled to yet (or were favorited from Mealie's own web UI) never show.
  const [favoriteRecipesFull, setFavoriteRecipesFull] = useState<RecipeSummary[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    if (!favoritesOnly) return;
    let cancelled = false;
    setLoadingFavorites(true);
    api.getRecipes({
      perPage: 1000,
      search: search || undefined,
      tags: filters.tags,
      categories: filters.categories,
      tools: filters.tools,
      foods: filters.foods,
    })
      .then(data => { if (!cancelled) setFavoriteRecipesFull(data.items); })
      .catch(() => { if (!cancelled) setFavoriteRecipesFull([]); })
      .finally(() => { if (!cancelled) setLoadingFavorites(false); });
    return () => { cancelled = true; };
  }, [favoritesOnly, search, filters]);

  const openFilter = () => {
    setShowFilter(true);
    ensureLoaded();
  };

  const removeFilter = (key: FilterKey, value: string) =>
    applyFilters({ ...filters, [key]: filters[key].filter(v => v !== value) });

  const handleRandom = async () => {
    setRandomizing(true);
    try {
      const recipe = await api.getRandomRecipe({
        search: search || undefined,
        tags: filters.tags, categories: filters.categories, tools: filters.tools, foods: filters.foods,
      });
      if (!recipe) { Alert.alert('No recipes found'); return; }
      navigation.navigate('RecipeDetail', { slug: recipe.slug, name: recipe.name });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not pick a random recipe');
    } finally {
      setRandomizing(false);
    }
  };

  const displayedRecipes = favoritesOnly
    ? favoriteRecipesFull.filter(r => favoriteIds.has(r.id))
    : recipes;
  const showLoading = favoritesOnly ? loadingFavorites : loading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterButton, favoritesOnly && styles.filterButtonActive]}
            onPress={() => setFavoritesOnly(prev => !prev)}
          >
            <Text style={[styles.filterIcon, favoritesOnly && styles.filterIconActive]}>
              {favoritesOnly ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={openFilter}>
            <Text style={styles.filterIcon}>▤</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={handleRandom} disabled={randomizing}>
            {randomizing
              ? <ActivityIndicator color={colors.textSecondary} size="small" />
              : <Text style={styles.filterIcon}>🎲</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => navigation.navigate('RecipeSuggestions')}
          >
            <Text style={styles.filterIcon}>🥕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddRecipe')}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes…"
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ActiveFilterChips filters={filters} options={options} onRemove={removeFilter} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : showLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : displayedRecipes.length === 0 ? (
        <EmptyState
          icon={favoritesOnly ? '♡' : '🍽️'}
          title={favoritesOnly ? 'No favorites yet' : search || activeFilterCount ? 'No recipes found' : 'No recipes yet'}
          subtitle={favoritesOnly
            ? 'Tap the heart on a recipe to favorite it'
            : search || activeFilterCount ? 'Try adjusting your search or filters' : 'Add your first recipe with the + button'}
        />
      ) : (
        <FlatList
          data={displayedRecipes}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => navigation.navigate('RecipeDetail', { slug: item.slug, name: item.name })}
            />
          )}
          onRefresh={favoritesOnly ? undefined : refresh}
          refreshing={showLoading}
          onEndReached={favoritesOnly ? undefined : loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
            : (favoritesOnly || !hasMore) && displayedRecipes.length > 0
              ? <Text style={styles.footerText}>{displayedRecipes.length} recipe{displayedRecipes.length === 1 ? '' : 's'}</Text>
              : null
          }
        />
      )}

      <RecipeFilterModal
        visible={showFilter}
        loading={filterLoading}
        options={options}
        filters={filters}
        onApply={applyFilters}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterButton: { position: 'relative', width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterIcon: { fontSize: 16, color: colors.textSecondary },
  filterIconActive: { color: colors.textInverse },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: typography.weight.bold, color: colors.textInverse },
  addButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 22, color: colors.textInverse, lineHeight: 28 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.size.md, color: colors.textPrimary },
  clearText: { fontSize: 14, color: colors.textDisabled, padding: spacing.xs },
  list: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { color: colors.error, fontSize: typography.size.md, textAlign: 'center', paddingHorizontal: spacing.xl },
  retryText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  footerLoader: { paddingVertical: spacing.lg },
  footerText: { textAlign: 'center', color: colors.textDisabled, fontSize: typography.size.sm, paddingVertical: spacing.lg },
});
