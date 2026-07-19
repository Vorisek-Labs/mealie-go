import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShoppingListDetail } from '../hooks/useShoppingLists';
import { api } from '../lib/mealieApi';
import { findPossibleMatchIds } from '../lib/shoppingMatch';
import EmptyState from '../components/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import type { RecipeSummary, ShoppingListItem } from '../types';
import type { ShoppingStackParams } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<ShoppingStackParams, 'ShoppingListDetail'>;
  route: RouteProp<ShoppingStackParams, 'ShoppingListDetail'>;
};

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

type GroupedSection = { label: { id: string; name: string; color?: string } | null; items: ShoppingListItem[] };

export default function ShoppingListDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { listId, listName } = route.params;
  const {
    list, labels, loading, error, refresh,
    addItem, toggleItem, deleteItem,
    generateFromMealPlan, addRecipes, mergeDuplicates, duplicateCount,
  } = useShoppingListDetail(listId);

  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [showAddRecipes, setShowAddRecipes] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeResults, setRecipeResults] = useState<RecipeSummary[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [addingRecipes, setAddingRecipes] = useState(false);
  const recipeSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = async () => {
    const note = newItem.trim();
    if (!note) return;
    const qty = parseFloat(newQty) || undefined;
    setAdding(true);
    try {
      await addItem(note, qty);
      setNewItem('');
      setNewQty('');
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('shopping.genericAddItemError'));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (item: ShoppingListItem) => {
    Alert.alert(
      t('shopping.removeItemTitle'),
      t('shopping.removeItemMsg', { name: item.display ?? item.note ?? item.food?.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('shopping.remove'), style: 'destructive', onPress: () => deleteItem(item.id) },
      ]
    );
  };

  const handleGenerateFromMealPlan = async () => {
    const now = new Date();
    const start = mondayOfWeek(now);
    const end = addDays(start, 6);
    setGenerating(true);
    try {
      await generateFromMealPlan(isoDate(start), isoDate(end));
      Alert.alert(t('shopping.doneTitle'), t('shopping.mealPlanAddedMsg'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('shopping.genericMealPlanError'));
    } finally {
      setGenerating(false);
    }
  };

  const openAddRecipes = () => {
    setRecipeSearch('');
    setRecipeResults([]);
    setSelectedRecipeIds(new Set());
    setShowAddRecipes(true);
  };

  const handleRecipeSearch = useCallback((term: string) => {
    setRecipeSearch(term);
    if (recipeSearchTimer.current) clearTimeout(recipeSearchTimer.current);
    if (!term.trim()) { setRecipeResults([]); return; }
    recipeSearchTimer.current = setTimeout(async () => {
      setRecipeSearching(true);
      try {
        const data = await api.getRecipes({ search: term, perPage: 20 });
        setRecipeResults(data.items);
      } catch {
        setRecipeResults([]);
      } finally {
        setRecipeSearching(false);
      }
    }, 400);
  }, []);

  const toggleRecipeSelected = (id: string) => {
    setSelectedRecipeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddSelectedRecipes = async () => {
    if (selectedRecipeIds.size === 0) return;
    setAddingRecipes(true);
    try {
      await addRecipes([...selectedRecipeIds]);
      setShowAddRecipes(false);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('shopping.genericAddRecipesError'));
    } finally {
      setAddingRecipes(false);
    }
  };

  const handleMergeDuplicates = async () => {
    Alert.alert(
      t('shopping.mergeDuplicatesTitle'),
      t('shopping.mergeDuplicatesMsg', { count: duplicateCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('shopping.merge'),
          style: 'destructive',
          onPress: async () => {
            const removed = await mergeDuplicates();
            if (removed) Alert.alert(t('shopping.doneTitle'), t('shopping.removedDuplicatesMsg', { count: removed }));
          },
        },
      ]
    );
  };

  const unchecked = list?.listItems.filter(i => !i.checked) ?? [];
  const checked = list?.listItems.filter(i => i.checked) ?? [];
  const total = list?.listItems.length ?? 0;
  const done = checked.length;

  // Items with no structured food link that might be the same thing as
  // another item, worded differently (Mealie's server already auto-merges
  // items that DO share a structured food, so this only covers what that
  // can't reach). Flagged, not auto-merged -- see lib/shoppingMatch.ts.
  const possibleMatchIds = useMemo(() => findPossibleMatchIds(unchecked), [unchecked]);

  // Group unchecked by label
  const buildGroups = (): GroupedSection[] => {
    if (!list || labels.length === 0) {
      return [{ label: null, items: unchecked }];
    }
    const byLabel: Record<string, ShoppingListItem[]> = {};
    unchecked.forEach(item => {
      const key = item.labelId ?? '_none';
      if (!byLabel[key]) byLabel[key] = [];
      byLabel[key].push(item);
    });
    const groups: GroupedSection[] = [];
    labels.forEach(label => {
      if (byLabel[label.id]?.length > 0) {
        groups.push({ label, items: byLabel[label.id] });
      }
    });
    if (byLabel['_none']?.length > 0) {
      groups.push({ label: null, items: byLabel['_none'] });
    }
    return groups;
  };

  const groups = buildGroups();
  const hasLabels = labels.length > 0;

  const explainPossibleMatch = () => Alert.alert(
    t('shopping.possibleMatchTitle'),
    t('shopping.possibleMatchMsg'),
  );

  const renderItem = (item: ShoppingListItem) => {
    const label = item.display ?? item.note ?? item.food?.name ?? t('shopping.itemFallback');
    const flagged = possibleMatchIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => toggleItem(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>{label}</Text>
        {flagged && !item.checked ? (
          <TouchableOpacity onPress={explainPossibleMatch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.possibleMatchIcon}>≈</Text>
          </TouchableOpacity>
        ) : null}
        {item.quantity ? (
          <Text style={styles.itemQty}>×{item.quantity}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>{listName}</Text>
          {total > 0 && <Text style={styles.progress}>{t('shopping.progress', { done, total })}</Text>}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerateFromMealPlan}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={styles.actionBtnText}>{t('shopping.fromMealPlan')}</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={openAddRecipes}>
          <Text style={styles.actionBtnText}>{t('shopping.fromRecipes')}</Text>
        </TouchableOpacity>
        {duplicateCount > 0 && (
          <TouchableOpacity style={styles.mergeBtn} onPress={handleMergeDuplicates}>
            <Text style={styles.mergeBtnText}>{t('shopping.mergeDupesBtn', { count: duplicateCount })}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>{t('common.retry')}</Text></TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <EmptyState icon="🛒" title={t('shopping.listEmptyTitle')} subtitle={t('shopping.listEmptySubtitle')} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} style={{ flex: 1 }}>
          {hasLabels ? (
            groups.map((group, gi) => (
              <View key={gi}>
                {group.label && (
                  <View style={styles.labelHeader}>
                    {group.label.color && (
                      <View style={[styles.labelDot, { backgroundColor: group.label.color }]} />
                    )}
                    <Text style={styles.labelName}>{group.label.name}</Text>
                  </View>
                )}
                {group.items.map(item => (
                  <View key={item.id}>{renderItem(item)}</View>
                ))}
              </View>
            ))
          ) : (
            unchecked.map(item => (
              <View key={item.id}>{renderItem(item)}</View>
            ))
          )}

          {checked.length > 0 && (
            <>
              <Text style={styles.divider}>{t('shopping.checkedCount', { count: checked.length })}</Text>
              {checked.map(item => (
                <View key={item.id}>{renderItem(item)}</View>
              ))}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <View style={styles.addBar}>
        <TextInput
          style={styles.addQtyInput}
          placeholder={t('shopping.qtyPlaceholder')}
          placeholderTextColor={colors.textDisabled}
          value={newQty}
          onChangeText={setNewQty}
          keyboardType="numeric"
          returnKeyType="next"
        />
        <TextInput
          style={styles.addInput}
          placeholder={t('shopping.addItemPlaceholder')}
          placeholderTextColor={colors.textDisabled}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addSubmit, adding && styles.buttonDisabled]}
          onPress={handleAdd}
          disabled={adding}
        >
          {adding
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={styles.addSubmitText}>{t('shopping.addButton')}</Text>
          }
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddRecipes}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddRecipes(false)}
      >
        <View style={addRecipesStyles.container}>
          <View style={addRecipesStyles.header}>
            <TouchableOpacity onPress={() => setShowAddRecipes(false)}>
              <Text style={addRecipesStyles.cancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={addRecipesStyles.title}>{t('shopping.addFromRecipesTitle')}</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={addRecipesStyles.searchBar}>
            <Text style={addRecipesStyles.searchIcon}>🔍</Text>
            <TextInput
              style={addRecipesStyles.searchInput}
              value={recipeSearch}
              onChangeText={handleRecipeSearch}
              placeholder={t('shopping.searchRecipesPlaceholder')}
              placeholderTextColor={colors.textDisabled}
              autoFocus
            />
          </View>

          {recipeSearching ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={recipeResults}
              keyExtractor={r => r.id}
              contentContainerStyle={addRecipesStyles.resultsList}
              ListEmptyComponent={
                <Text style={addRecipesStyles.emptyText}>
                  {recipeSearch.trim() ? t('shopping.noRecipesFound') : t('shopping.searchToAddIngredients')}
                </Text>
              }
              renderItem={({ item }) => {
                const selected = selectedRecipeIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={addRecipesStyles.resultItem}
                    onPress={() => toggleRecipeSelected(item.id)}
                  >
                    <View style={[addRecipesStyles.checkbox, selected && addRecipesStyles.checkboxChecked]}>
                      {selected && <Text style={addRecipesStyles.checkmark}>✓</Text>}
                    </View>
                    <Text style={addRecipesStyles.resultName} numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[addRecipesStyles.confirmBtn, (selectedRecipeIds.size === 0 || addingRecipes) && { opacity: 0.5 }]}
            onPress={handleAddSelectedRecipes}
            disabled={selectedRecipeIds.size === 0 || addingRecipes}
          >
            {addingRecipes
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={addRecipesStyles.confirmBtnText}>
                  {selectedRecipeIds.size > 0
                    ? t('shopping.addRecipesButtonWithCount', { count: selectedRecipeIds.size })
                    : t('shopping.addRecipesButton')}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  back: { fontSize: 28, color: colors.textSecondary, width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary },
  progress: { fontSize: typography.size.sm, color: colors.textSecondary },
  actionBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionBtnText: { fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: typography.weight.medium },
  mergeBtn: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1, borderColor: colors.warning },
  mergeBtnText: { fontSize: typography.size.sm, color: colors.warning, fontWeight: typography.weight.medium },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  list: { paddingBottom: 80 },
  labelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  labelName: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { fontSize: 14, color: colors.textInverse, fontWeight: typography.weight.bold },
  itemText: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  itemTextChecked: { color: colors.textDisabled, textDecorationLine: 'line-through' },
  itemQty: { fontSize: typography.size.sm, color: colors.textSecondary },
  possibleMatchIcon: { fontSize: typography.size.md, color: colors.warning, fontWeight: typography.weight.bold },
  divider: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  addBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  addQtyInput: { width: 52, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: typography.size.md, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, textAlign: 'center' },
  addInput: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.size.md, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  addSubmit: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  addSubmitText: { color: colors.textInverse, fontWeight: typography.weight.semibold, fontSize: typography.size.md },
  errorText: { color: colors.error, fontSize: typography.size.md },
  retryText: { color: colors.primary, fontSize: typography.size.md },
});

const addRecipesStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: typography.size.md, color: colors.textSecondary, width: 60 },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.textPrimary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, marginHorizontal: spacing.md, marginVertical: spacing.sm,
    paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: typography.size.md, color: colors.textPrimary },
  resultsList: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { fontSize: 14, color: colors.textInverse, fontWeight: typography.weight.bold },
  resultName: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: typography.size.md, marginTop: spacing.xl },
  confirmBtn: {
    margin: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  confirmBtnText: { color: colors.textInverse, fontSize: typography.size.lg, fontWeight: typography.weight.semibold },
});
