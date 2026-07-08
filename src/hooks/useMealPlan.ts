import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { MealPlanEntry, CreateMealPlanEntry } from '../types';

function weekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

export function useMealPlan(weekDate: Date) {
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = weekBounds(weekDate);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMealPlans(start, end);
      setEntries(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meal plan');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  const addEntry = useCallback(async (data: CreateMealPlanEntry) => {
    const entry = await api.createMealPlan(data);
    setEntries(prev => [...prev, entry]);
  }, []);

  const removeEntry = useCallback(async (id: number) => {
    await api.deleteMealPlan(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  return { entries, loading, error, refresh, addEntry, removeEntry, weekStart: start, weekEnd: end };
}
