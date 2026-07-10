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

  const generateFromMealPlan = useCallback(async (weekStart: string, weekEnd: string) => {
    const mealPlan = await api.getMealPlans(weekStart, weekEnd);
    const recipeIds = [...new Set(
      mealPlan.items
        .filter(e => e.recipeId)
        .map(e => e.recipeId as string)
    )];
    if (recipeIds.length === 0) return;
    await api.addRecipesToShoppingList(listId, recipeIds);
    await refresh();
  }, [listId, refresh]);

  const addRecipes = useCallback(async (recipeIds: string[]) => {
    if (recipeIds.length === 0) return;
    await api.addRecipesToShoppingList(listId, recipeIds);
    await refresh();
  }, [listId, refresh]);

  const mergeDuplicates = useCallback(async () => {
    if (!list) return;
    const unchecked = list.listItems.filter(i => !i.checked);
    const seen = new Map<string, ShoppingListItem>();
    const toDelete: string[] = [];
    for (const item of unchecked) {
      const key = (item.note ?? item.food?.name ?? '').trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(item.id);
      } else {
        seen.set(key, item);
      }
    }
    if (toDelete.length === 0) return 0;
    await Promise.all(toDelete.map(id => api.deleteShoppingItem(id)));
    setList(prev => prev
      ? { ...prev, listItems: prev.listItems.filter(i => !toDelete.includes(i.id)) }
      : prev
    );
    return toDelete.length;
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
    generateFromMealPlan, addRecipes, mergeDuplicates, duplicateCount,
  };
}
