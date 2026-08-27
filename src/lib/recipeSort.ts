import type { RecipeSummary } from '../types';

export type SortDirection = 'asc' | 'desc';

// 'favorites' is the one option with no server-side equivalent — Mealie stores
// favorites per-user in a separate ratings table, not as a column on the recipe
// itself, so there's nothing to pass to `orderBy`. It's sorted client-side over
// a full fetch instead (see `useRecipes`), the same trick RecipesScreen already
// uses for its "favorites only" toggle.
export type RecipeSortKey = 'name' | 'created' | 'updated' | 'rating' | 'lastMade' | 'favorites';

export interface RecipeSort {
  key: RecipeSortKey;
  direction: SortDirection;
}

interface RecipeSortOption {
  key: RecipeSortKey;
  icon: string;
  // Column name on Mealie's own RecipeModel (snake_case), not the camelCase
  // field name from the JSON response. `null` means client-side only.
  // Confirmed against Mealie's `RecipeCardSection.vue`, which sends exactly
  // these strings, and against the model/mixin that defines the columns.
  orderBy: string | null;
  // Which direction feels like "the point" of this sort when you first pick it
  // — alphabetical starts A→Z, everything date/score-shaped starts newest/best
  // first. Matches the defaults Mealie's own sort menu uses.
  defaultDirection: SortDirection;
  // Nullable column: recipes with no rating / never marked as made. These are
  // pinned last in BOTH directions rather than following the sort — deliberately
  // different from Mealie's web UI (which puts nulls first when ascending),
  // because "lowest rated first" showing a wall of unrated recipes ahead of the
  // actual 1-star ones isn't what anyone means by that sort.
  nullable?: boolean;
}

// Order here is the order shown in the sort menu.
export const SORT_OPTIONS: RecipeSortOption[] = [
  { key: 'name', icon: '🔤', orderBy: 'name', defaultDirection: 'asc' },
  { key: 'created', icon: '📅', orderBy: 'created_at', defaultDirection: 'desc' },
  { key: 'updated', icon: '✏️', orderBy: 'updated_at', defaultDirection: 'desc' },
  { key: 'rating', icon: '⭐', orderBy: 'rating', defaultDirection: 'desc', nullable: true },
  { key: 'lastMade', icon: '🍳', orderBy: 'last_made', defaultDirection: 'desc', nullable: true },
  { key: 'favorites', icon: '♥', orderBy: null, defaultDirection: 'desc' },
];

export const DEFAULT_SORT: RecipeSort = { key: 'name', direction: 'asc' };

export function sortOption(key: RecipeSortKey): RecipeSortOption {
  return SORT_OPTIONS.find(o => o.key === key) ?? SORT_OPTIONS[0];
}

// Picking the option that's already active reverses it; picking a different one
// starts it at its own natural direction. Same interaction as Mealie's web UI.
export function nextSort(current: RecipeSort, key: RecipeSortKey): RecipeSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: sortOption(key).defaultDirection };
}

export function isClientSideSort(key: RecipeSortKey): boolean {
  return sortOption(key).orderBy === null;
}

// The query params for a sort — `undefined` orderBy leaves buildRecipeQuery on
// its own name/asc default, which is the right stable base for a client-side
// sort to then reorder.
export function sortQueryParams(sort: RecipeSort): {
  orderBy?: string;
  orderDirection?: SortDirection;
  orderByNullPosition?: 'first' | 'last';
} {
  const option = sortOption(sort.key);
  if (!option.orderBy) return {};
  return {
    orderBy: option.orderBy,
    orderDirection: sort.direction,
    orderByNullPosition: option.nullable ? 'last' : undefined,
  };
}

// Applied only for sorts with no server-side equivalent. Returns the input
// untouched for every server-sorted option, so callers can pipe everything
// through this unconditionally.
//
// Deliberately a two-pass partition rather than `.sort()` with a comparator:
// this runs synchronously inside a `useMemo` during render, over the FULL
// recipe set (the favorites sort can't paginate), so an O(n log n) comparator
// blocks the JS thread and visibly freezes the UI. The first version here used
// `localeCompare` as a name tiebreak and did exactly that — ~10,000 locale-aware
// string comparisons on a 1,000-recipe library, which is slow in Hermes.
// The tiebreak was never needed: the server already returns the set ordered by
// name ascending, and filtering preserves that order within each group. This is
// O(n) with zero string comparisons.
export function applyClientSideSort(
  recipes: RecipeSummary[],
  sort: RecipeSort,
  favoriteIds: Set<string>,
): RecipeSummary[] {
  if (sort.key !== 'favorites') return recipes;
  const favorites = recipes.filter(r => favoriteIds.has(r.id));
  // Nothing favorited (or nothing loaded yet) — skip building two more arrays.
  if (favorites.length === 0 || favorites.length === recipes.length) return recipes;
  const rest = recipes.filter(r => !favoriteIds.has(r.id));
  return sort.direction === 'desc' ? [...favorites, ...rest] : [...rest, ...favorites];
}
