import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { Cookbook, RecipeSummary } from '../types';

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

  return { cookbooks, loading, error, refresh };
}

export function useCookbookRecipes(slug: string) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCookbookRecipes(slug);
      setRecipes(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cookbook recipes');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  return { recipes, loading, error, refresh };
}
