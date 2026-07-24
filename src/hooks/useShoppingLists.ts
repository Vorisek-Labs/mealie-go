import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { ShoppingLabel, ShoppingList, ShoppingListItem, ShoppingListWithItems } from '../types';

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getShoppingLists();
      setLists(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shopping lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createList = useCallback(async (name: string) => {
    const list = await api.createShoppingList(name);
    setLists(prev => [...prev, list]);
  }, []);

  const deleteList = useCallback(async (id: string) => {
    await api.deleteShoppingList(id);
    setLists(prev => prev.filter(l => l.id !== id));
  }, []);

  return { lists, loading, error, refresh, createList, deleteList };
}

export function useShoppingListDetail(listId: string) {
  const [list, setList] = useState<ShoppingListWithItems | null>(null);
  const [labels, setLabels] = useState<ShoppingLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, labelData] = await Promise.all([
        api.getShoppingList(listId),
        api.getShoppingLabels().catch(() => ({ items: [] })),
      ]);
      setList(data);
      setLabels(labelData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addItem = useCallback(async (note: string, quantity?: number, labelId?: string) => {
    const item = await api.addShoppingItem(listId, note, quantity, labelId);
    setList(prev => prev ? { ...prev, listItems: [...prev.listItems, item] } : prev);
  }, [listId]);

  const toggleItem = useCallback(async (item: ShoppingListItem) => {
    const updated = await api.updateShoppingItem(item.id, { ...item, checked: !item.checked });
    setList(prev => prev
      ? { ...prev, listItems: prev.listItems.map(i => i.id === item.id ? updated : i) }
      : prev
    );
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    await api.deleteShoppingItem(itemId);
    setList(prev => prev
      ? { ...prev, listItems: prev.listItems.filter(i => i.id !== itemId) }
      : prev
    );
  }, []);

  // Mealie's own meal-plan endpoint takes an arbitrary start/end date range
  // (no "one week at a time" restriction server-side) -- this fetches one or
  // more such ranges in parallel, unions the distinct recipes across all of
  // them, and adds each exactly once via the same bulk add-recipe endpoint
  // used elsewhere, so a recipe planned in two selected weeks isn't added twice.
  const addFromMealPlanWeeks = useCallback(async (weeks: { start: string; end: string }[]) => {
    if (weeks.length === 0) return 0;
    const mealPlans = await Promise.all(weeks.map(w => api.getMealPlans(w.start, w.end)));
    const recipeIds = [...new Set(
      mealPlans
        .flatMap(mp => mp.items)
        .filter(e => e.recipeId)
        .map(e => e.recipeId as string)
    )];
    if (recipeIds.length === 0) return 0;
    await api.addRecipesToShoppingList(listId, recipeIds);
    await refresh();
    return recipeIds.length;
  }, [listId, refresh]);

  const addRecipes = useCallback(async (recipeIds: string[]) => {
    if (recipeIds.length === 0) return;
    await api.addRecipesToShoppingList(listId, recipeIds);
    await refresh();
  }, [listId, refresh]);

  const removeRecipe = useCallback(async (recipeId: string) => {
    await api.removeRecipeFromShoppingList(listId, recipeId);
    await refresh();
  }, [listId, refresh]);

  // Merges items with identical note text by summing their quantities onto
  // one "keeper" and removing the rest — NOT by just deleting the extras,
  // which would silently throw away however much of that item the deleted
  // duplicates represented.
  const mergeDuplicates = useCallback(async () => {
    if (!list) return;
    const unchecked = list.listItems.filter(i => !i.checked);
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of unchecked) {
      const key = (item.note ?? item.food?.name ?? '').trim().toLowerCase();
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }

    const removedIds: string[] = [];
    const keeperUpdates: Promise<unknown>[] = [];
    const keeperResults = new Map<string, ShoppingListItem>();

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keeper, ...rest] = group;
      rest.forEach(i => removedIds.push(i.id));

      const summedQty = group.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
      if (summedQty > 0 && summedQty !== keeper.quantity) {
        const updated = { ...keeper, quantity: summedQty };
        keeperResults.set(keeper.id, updated);
        keeperUpdates.push(api.updateShoppingItem(keeper.id, updated));
      }
    }

    if (removedIds.length === 0) return 0;
    await Promise.all([
      ...keeperUpdates,
      ...removedIds.map(id => api.deleteShoppingItem(id)),
    ]);
    setList(prev => prev
      ? {
          ...prev,
          listItems: prev.listItems
            .filter(i => !removedIds.includes(i.id))
            .map(i => keeperResults.get(i.id) ?? i),
        }
      : prev
    );
    return removedIds.length;
  }, [list]);

  const duplicateCount = (() => {
    if (!list) return 0;
    const unchecked = list.listItems.filter(i => !i.checked);
    const seen = new Set<string>();
    let count = 0;
    for (const item of unchecked) {
      const key = (item.note ?? item.food?.name ?? '').trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) count++;
      else seen.add(key);
    }
    return count;
  })();

  return {
    list, labels, loading, error, refresh,
    addItem, toggleItem, deleteItem,
    addFromMealPlanWeeks, addRecipes, removeRecipe, mergeDuplicates, duplicateCount,
  };
}
