import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { Cookbook, CookbookInput } from '../types';

export function useCookbooks() {
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCookbooks();
      setCookbooks(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cookbooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createCookbook = useCallback(async (data: CookbookInput) => {
    const cookbook = await api.createCookbook(data);
    setCookbooks(prev => [...prev, cookbook]);
    return cookbook;
  }, []);

  const updateCookbook = useCallback(async (id: string, data: CookbookInput) => {
    const cookbook = await api.updateCookbook(id, data);
    setCookbooks(prev => prev.map(c => c.id === id ? cookbook : c));
    return cookbook;
  }, []);

  const deleteCookbook = useCallback(async (id: string) => {
    await api.deleteCookbook(id);
    setCookbooks(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cookbooks, loading, error, refresh, createCookbook, updateCookbook, deleteCookbook };
}
