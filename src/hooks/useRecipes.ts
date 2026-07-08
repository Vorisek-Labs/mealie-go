import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { RecipeSummary } from '../types';

export function useRecipes() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef('');
  const filterTagsRef = useRef<string[]>([]);
  const filterCatsRef = useRef<string[]>([]);

  searchRef.current = search;
  filterTagsRef.current = filterTags;
  filterCatsRef.current = filterCategories;

  const fetchPage = useCallback(async (
    pageNum: number,
    searchTerm: string,
    replace: boolean,
    tags?: string[],
    cats?: string[],
  ) => {
    try {
      const data = await api.getRecipes({
        page: pageNum,
        perPage: 50,
        search: searchTerm || undefined,
        tags: tags ?? filterTagsRef.current,
        categories: cats ?? filterCatsRef.current,
      });
      setRecipes(prev => replace ? data.items : [...prev, ...data.items]);
      setHasMore(pageNum < data.total_pages);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recipes');
    }
  }, []);

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

  const applyFilters = useCallback(async (tags: string[], cats: string[]) => {
    setFilterTags(tags);
    setFilterCategories(cats);
    filterTagsRef.current = tags;
    filterCatsRef.current = cats;
    setLoading(true);
    setError(null);
    await fetchPage(1, searchRef.current, true, tags, cats);
    setLoading(false);
  }, [fetchPage]);

  const activeFilterCount = filterTags.length + filterCategories.length;

  return {
    recipes, loading, loadingMore, error,
    search, setSearch: handleSearch,
    refresh, loadMore, hasMore,
    filterTags, filterCategories, applyFilters, activeFilterCount,
  };
}
