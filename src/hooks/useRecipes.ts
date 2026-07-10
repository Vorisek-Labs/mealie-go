import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { RecipeSummary } from '../types';

export interface RecipeFilters {
  tags: string[];       // slugs
  categories: string[]; // slugs
  tools: string[];      // slugs
  foods: string[];      // UUIDs (foods have no slug)
}

export const EMPTY_FILTERS: RecipeFilters = { tags: [], categories: [], tools: [], foods: [] };

// Pass a cookbook slug to scope every fetch to that cookbook's recipes —
// used by CookbookDetailScreen to get the same search/filter/pagination
// behavior as the main Recipes list, just narrowed to one cookbook.
export function useRecipes(cookbookSlug?: string) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_FILTERS);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef('');
  const filtersRef = useRef<RecipeFilters>(EMPTY_FILTERS);

  searchRef.current = search;
  filtersRef.current = filters;

  const fetchPage = useCallback(async (
    pageNum: number,
    searchTerm: string,
    replace: boolean,
    overrideFilters?: RecipeFilters,
  ) => {
    try {
      const f = overrideFilters ?? filtersRef.current;
      const data = await api.getRecipes({
        page: pageNum,
        perPage: 50,
        search: searchTerm || undefined,
        tags: f.tags,
        categories: f.categories,
        tools: f.tools,
        foods: f.foods,
        cookbook: cookbookSlug,
      });
      setRecipes(prev => replace ? data.items : [...prev, ...data.items]);
      setHasMore(pageNum < data.total_pages);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recipes');
    }
  }, [cookbookSlug]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchPage(1, searchRef.current, true);
    setLoading(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPage(page + 1, searchRef.current, false);
    setLoadingMore(false);
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback((term: string) => {
    setSearch(term);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      await fetchPage(1, term, true);
      setLoading(false);
    }, 400);
  }, [fetchPage]);

  const applyFilters = useCallback(async (next: RecipeFilters) => {
    setFilters(next);
    filtersRef.current = next;
    setLoading(true);
    setError(null);
    await fetchPage(1, searchRef.current, true, next);
    setLoading(false);
  }, [fetchPage]);

  const activeFilterCount =
    filters.tags.length + filters.categories.length + filters.tools.length + filters.foods.length;

  return {
    recipes, loading, loadingMore, error,
    search, setSearch: handleSearch,
    refresh, loadMore, hasMore,
    filters, applyFilters, activeFilterCount,
  };
}
