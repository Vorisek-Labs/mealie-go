import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/mealieApi';
import { matchesCookTimeBucket, matchesPrepTimeBucket } from '../lib/timeEstimate';
import {
  applyClientSideSort, DEFAULT_SORT, isClientSideSort, sortQueryParams,
} from '../lib/recipeSort';
import type { RecipeSort } from '../lib/recipeSort';
import { useFavorites } from '../context/FavoritesContext';
import type { RecipeSummary } from '../types';

export interface RecipeFilters {
  tags: string[];       // slugs
  categories: string[]; // slugs
  tools: string[];      // slugs
  foods: string[];      // UUIDs (foods have no slug)
  // Mealie has no server-side time filter (prep/cook time are freeform text,
  // not a queryable number) — these are applied client-side only. Kept
  // separate rather than one combined "total time" filter since a recipe's
  // prep and cook time are independent (e.g. long marinade + quick cook).
  maxPrepMinutes?: number;
  maxCookMinutes?: number;
}

export const EMPTY_FILTERS: RecipeFilters = {
  tags: [], categories: [], tools: [], foods: [], maxPrepMinutes: undefined, maxCookMinutes: undefined,
};

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
  // How many recipes match the current search/filters server-side — NOT how many
  // are currently loaded into `recipes`, which in paginated mode is just the
  // pages scrolled so far.
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<RecipeSort>(DEFAULT_SORT);
  const { favoriteIds } = useFavorites();

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef('');
  const filtersRef = useRef<RecipeFilters>(EMPTY_FILTERS);
  const sortRef = useRef<RecipeSort>(DEFAULT_SORT);

  searchRef.current = search;
  filtersRef.current = filters;
  sortRef.current = sort;

  const fetchPage = useCallback(async (
    pageNum: number,
    searchTerm: string,
    replace: boolean,
    overrideFilters?: RecipeFilters,
    overrideSort?: RecipeSort,
  ) => {
    try {
      const f = overrideFilters ?? filtersRef.current;
      const s = overrideSort ?? sortRef.current;
      // Two things force pulling the whole matching set in one page instead of
      // paginating: a prep/cook-time bucket (Mealie has no server-side time
      // filter), and a sort with no server-side equivalent (favorites), which
      // can only order what it can see. Same trick RecipesScreen already uses
      // for "favorites only".
      //
      // perPage -1 means "every match" to Mealie (it interprets -1 as get_all,
      // uncapped — present since v2.0.0, this app's supported floor). This used
      // to be a hardcoded 1000, which SILENTLY TRUNCATED any library larger than
      // that: recipes past #1000 alphabetically were simply absent, so a
      // favorite or a quick-to-cook recipe sitting past the cutoff just never
      // appeared, with nothing to indicate the list was incomplete.
      const fullFetch = !!f.maxPrepMinutes || !!f.maxCookMinutes || isClientSideSort(s.key);
      const data = await api.getRecipes({
        page: fullFetch ? 1 : pageNum,
        perPage: fullFetch ? -1 : 50,
        search: searchTerm || undefined,
        tags: f.tags,
        categories: f.categories,
        tools: f.tools,
        foods: f.foods,
        cookbook: cookbookSlug,
        ...sortQueryParams(s),
      });
      const items = (f.maxPrepMinutes || f.maxCookMinutes)
        ? data.items.filter(r => matchesPrepTimeBucket(r, f.maxPrepMinutes) && matchesCookTimeBucket(r, f.maxCookMinutes))
        : data.items;
      setRecipes(prev => replace ? items : [...prev, ...items]);
      // `data.total` counts what the SERVER matched, so it already reflects
      // search + tags/categories/tools/foods + cookbook. It can't know about the
      // prep/cook-time buckets though (those are filtered client-side above), so
      // when either is active the honest count is what survived that filter.
      // Safe to read `items.length` here: a time filter forces `fullFetch`, so
      // `items` is the complete matching set rather than one page of it.
      setTotal((f.maxPrepMinutes || f.maxCookMinutes) ? items.length : data.total);
      setHasMore(fullFetch ? false : pageNum < data.total_pages);
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

  const applySort = useCallback(async (next: RecipeSort) => {
    setSort(next);
    sortRef.current = next;
    setLoading(true);
    setError(null);
    await fetchPage(1, searchRef.current, true, undefined, next);
    setLoading(false);
  }, [fetchPage]);

  // Kept out of `fetchPage` so that favouriting something re-orders the list
  // immediately, rather than only after the next fetch.
  const sortedRecipes = useMemo(
    () => applyClientSideSort(recipes, sort, favoriteIds),
    [recipes, sort, favoriteIds],
  );

  const activeFilterCount =
    filters.tags.length + filters.categories.length + filters.tools.length + filters.foods.length
    + (filters.maxPrepMinutes ? 1 : 0) + (filters.maxCookMinutes ? 1 : 0);

  return {
    recipes: sortedRecipes, loading, loadingMore, error,
    search, setSearch: handleSearch,
    refresh, loadMore, hasMore, total,
    filters, applyFilters, activeFilterCount,
    sort, applySort,
  };
}
