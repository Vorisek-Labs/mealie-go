import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/mealieApi';
import { localIsoDate } from '../lib/localDate';
import type { MealPlanEntry, CreateMealPlanEntry } from '../types';

function weekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: localIsoDate(monday), end: localIsoDate(sunday) };
}

export function useMealPlan(weekDate: Date) {
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = weekBounds(weekDate);

  // Only the newest request may write state, so a slow response for a previous
  // week (or an earlier focus refresh) can't overwrite the week now on screen
  // or end its spinner early.
  const latestRequest = useRef(0);

  // `silent` re-fetches without the spinner and keeps the current list if the
  // request fails, for refreshing when the screen regains focus.
  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const requestId = ++latestRequest.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api.getMealPlans(start, end);
      if (requestId !== latestRequest.current) return;
      setEntries(data.items);
      setError(null);
    } catch (e) {
      if (requestId !== latestRequest.current) return;
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load meal plan');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
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
