import React, { useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecipes } from '../hooks/useRecipes';
import { api } from '../lib/mealieApi';
import RecipeCard from '../components/RecipeCard';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeTag, RecipeCategory } from '../types';
import type { RecipesStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RecipesStackParams, 'RecipesList'>;
};

export default function RecipesScreen({ navigation }: Props) {
  const {
    recipes, loading, loadingMore, error, search, setSearch,
    refresh, loadMore, hasMore, filterTags, filterCategories, applyFilters, activeFilterCount,
  } = useRecipes();

  const [showFilter, setShowFilter] = useState(false);
  const [availableTags, setAvailableTags] = useState<RecipeTag[]>([]);
  const [availableCategories, setAvailableCategories] = useState<RecipeCategory[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftCats, setDraftCats] = useState<string[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const openFilter = async () => {
    setDraftTags(filterTags);
    setDraftCats(filterCategories);
    setShowFilter(true);
    if (availableTags.length === 0) {
      setFilterLoading(true);
      try {
        const [tagData, catData] = await Promise.all([
          api.getTags().catch(() => ({ items: [] })),
          api.getCategories().catch(() => ({ items: [] })),
        ]);
        setAvailableTags(tagData.items);
        setAvailableCategories(catData.items);
      } finally {
        setFilterLoading(false);
      }
    }
  };

  const applyAndClose = async () => {
    setShowFilter(false);
    await applyFilters(draftTags, draftCats);
  };

  const clearFilters = async () => {
    setDraftTags([]);
    setDraftCats([]);
    setShowFilter(false);
    await applyFilters([], []);
  };

  const toggleTag = (slug: string) =>
    setDraftTags(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);

  const toggleCat = (slug: string) =>
    setDraftCats(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton} onPress={openFilter}>
            <Text style={styles.filterIcon}>⚙</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
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

      {activeFilterCount > 0 && (
        <View style={styles.activeFilterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterScroll}>
            {filterTags.map(slug => {
              const tag = availableTags.find(t => t.slug === slug);
              return (
                <TouchableOpacity
                  key={slug}
                  style={styles.activeFilterChip}
                  onPress={() => applyFilters(filterTags.filter(s => s !== slug), filterCategories)}
                >
                  <Text style={styles.activeFilterText}>{tag?.name ?? slug} ✕</Text>
                </TouchableOpacity>
              );
            })}
            {filterCategories.map(slug => {
              const cat = availableCategories.find(c => c.slug === slug);
              return (
                <TouchableOpacity
                  key={slug}
                  style={styles.activeFilterChip}
                  onPress={() => applyFilters(filterTags, filterCategories.filter(s => s !== slug))}
                >
                  <Text style={styles.activeFilterText}>{cat?.name ?? slug} ✕</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title={search || activeFilterCount ? 'No recipes found' : 'No recipes yet'}
          subtitle={search || activeFilterCount ? 'Try adjusting your search or filters' : 'Add your first recipe with the + button'}
        />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => navigation.navigate('RecipeDetail', { slug: item.slug, name: item.name })}
            />
          )}
          onRefresh={refresh}
          refreshing={loading}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
            : hasMore ? null : recipes.length > 0
              ? <Text style={styles.footerText}>{recipes.length} recipes</Text>
              : null
          }
        />
      )}

      <Modal visible={showFilter} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilter(false)}>
        <View style={filterStyles.container}>
          <View style={filterStyles.header}>
            <TouchableOpacity onPress={() => setShowFilter(false)}>
              <Text style={filterStyles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={filterStyles.title}>Filter Recipes</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={filterStyles.clear}>Clear all</Text>
            </TouchableOpacity>
          </View>

          {filterLoading ? (
            <View style={filterStyles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={filterStyles.scroll}>
              {availableTags.length > 0 && (
                <>
                  <Text style={filterStyles.sectionLabel}>TAGS</Text>
                  <View style={filterStyles.chipRow}>
                    {availableTags.map(tag => {
                      const active = draftTags.includes(tag.slug);
                      return (
                        <TouchableOpacity
                          key={tag.slug}
                          style={[filterStyles.chip, active && filterStyles.chipActive]}
                          onPress={() => toggleTag(tag.slug)}
                        >
                          <Text style={[filterStyles.chipText, active && filterStyles.chipTextActive]}>
                            {tag.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {availableCategories.length > 0 && (
                <>
                  <Text style={filterStyles.sectionLabel}>CATEGORIES</Text>
                  <View style={filterStyles.chipRow}>
                    {availableCategories.map(cat => {
                      const active = draftCats.includes(cat.slug);
                      return (
                        <TouchableOpacity
                          key={cat.slug}
                          style={[filterStyles.chip, active && filterStyles.chipActive]}
                          onPress={() => toggleCat(cat.slug)}
                        >
                          <Text style={[filterStyles.chipText, active && filterStyles.chipTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {!filterLoading && availableTags.length === 0 && availableCategories.length === 0 && (
                <Text style={filterStyles.emptyText}>No tags or categories found on your server.</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={filterStyles.applyBtn} onPress={applyAndClose}>
            <Text style={filterStyles.applyBtnText}>
              Apply{(draftTags.length + draftCats.length) > 0 ? ` (${draftTags.length + draftCats.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  filterIcon: { fontSize: 16, color: colors.textSecondary },
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
  activeFilterBar: { marginBottom: spacing.xs },
  activeFilterScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  activeFilterChip: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  activeFilterText: { fontSize: typography.size.xs, color: colors.textInverse, fontWeight: typography.weight.medium },
  list: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { color: colors.error, fontSize: typography.size.md, textAlign: 'center', paddingHorizontal: spacing.xl },
  retryText: { color: colors.primary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  footerLoader: { paddingVertical: spacing.lg },
  footerText: { textAlign: 'center', color: colors.textDisabled, fontSize: typography.size.sm, paddingVertical: spacing.lg },
});

const filterStyles = StyleSheet.create({
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
