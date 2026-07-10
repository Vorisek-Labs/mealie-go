import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { useRecipes } from '../hooks/useRecipes';
import { useRecipeFilterOptions } from '../hooks/useRecipeFilterOptions';
import type { RecipeFilters } from '../hooks/useRecipes';
import { api } from '../lib/mealieApi';
import RecipeCard from '../components/RecipeCard';
import RecipeFilterModal from '../components/RecipeFilterModal';
import ActiveFilterChips from '../components/ActiveFilterChips';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { CookbooksStackParams, MainTabParams } from '../navigation/RootNavigator';
import type { RecipeSummary } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<CookbooksStackParams, 'CookbookDetail'>;
  route: RouteProp<CookbooksStackParams, 'CookbookDetail'>;
};

type FilterKey = keyof RecipeFilters;

export default function CookbookDetailScreen({ navigation, route }: Props) {
  const { slug, name } = route.params;
  const {
    recipes, loading, loadingMore, error, search, setSearch,
    refresh, loadMore, hasMore, filters, applyFilters, activeFilterCount,
  } = useRecipes(slug);
  const { options, loading: filterLoading, ensureLoaded } = useRecipeFilterOptions();
  const [showFilter, setShowFilter] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const tabNavigation = useNavigation<NavigationProp<MainTabParams>>();

  const openRecipe = (item: RecipeSummary) => {
    tabNavigation.navigate('Recipes', {
      screen: 'RecipeDetail',
      params: { slug: item.slug, name: item.name },
    } as never);
  };

  const openFilter = () => {
    setShowFilter(true);
    ensureLoaded();
  };

  const removeFilter = (key: FilterKey, value: string) => {
    if (key === 'maxPrepMinutes' || key === 'maxCookMinutes') {
      applyFilters({ ...filters, [key]: undefined });
      return;
    }
    applyFilters({ ...filters, [key]: filters[key].filter(v => v !== value) });
  };

  const handleRandom = async () => {
    setRandomizing(true);
    try {
      const recipe = await api.getRandomRecipe({
        cookbook: slug,
        search: search || undefined,
        tags: filters.tags, categories: filters.categories, tools: filters.tools, foods: filters.foods,
      });
      if (!recipe) { Alert.alert('No recipes found in this cookbook'); return; }
      openRecipe(recipe);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not pick a random recipe');
    } finally {
      setRandomizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton} onPress={openFilter}>
            <Text style={styles.iconButtonText}>▤</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleRandom} disabled={randomizing}>
            {randomizing
              ? <ActivityIndicator color={colors.textSecondary} size="small" />
              : <Text style={styles.iconButtonText}>🎲</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search this cookbook…"
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

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon="📖"
          title={search || activeFilterCount ? 'No recipes found' : 'No recipes'}
          subtitle={search || activeFilterCount ? 'Try adjusting your search or filters' : 'Add recipes to this cookbook in Mealie'}
        />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          onRefresh={refresh}
          refreshing={loading}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => openRecipe(item)}
            />
          )}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
  },
  back: { fontSize: 28, color: colors.textSecondary, width: 32 },
  title: { flex: 1, fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    position: 'relative', width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconButtonText: { fontSize: 15, color: colors.textSecondary },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: typography.weight.bold, color: colors.textInverse },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.size.md, color: colors.textPrimary },
  clearText: { fontSize: 14, color: colors.textDisabled, padding: spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  list: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  footerLoader: { paddingVertical: spacing.lg },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});
