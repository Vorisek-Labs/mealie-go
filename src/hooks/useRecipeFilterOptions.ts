import { useCallback, useState } from 'react';
import { api } from '../lib/mealieApi';
import type { RecipeCategory, RecipeFood, RecipeTag, RecipeTool } from '../types';
import type { RecipeFilters } from './useRecipes';

export interface FilterOptionSets {
  tags: RecipeTag[];
  categories: RecipeCategory[];
  tools: RecipeTool[];
  foods: RecipeFood[];
}

const EMPTY_OPTIONS: FilterOptionSets = { tags: [], categories: [], tools: [], foods: [] };

// Module-level, not per-hook: these lists describe the whole server and barely
// change, but the foods table in particular is big (Mealie seeds thousands of
// entries), so refetching it per screen instance was the bulk of the delay when
// opening the filter modal or "What Can I Make?". Cached here, the first open in
// a session pays for it once and every open after that is instant — including
// across screens, since RecipesScreen and CookbookDetailScreen each hold their
// own copy of this hook.
//
// `inFlight` dedupes concurrent callers so two screens opening at once share a
// single round trip rather than racing two identical ones.
let optionsCache: FilterOptionSets | null = null;
let inFlight: Promise<FilterOptionSets> | null = null;

// MUST be called on logout / server switch — otherwise the next account sees the
// previous server's tags, categories, tools and foods. Wired into AuthContext.
export function clearRecipeFilterOptionsCache(): void {
  optionsCache = null;
  inFlight = null;
}

async function fetchOptions(): Promise<FilterOptionSets> {
  const [tagData, catData, toolData, foodData] = await Promise.all([
    api.getTags().catch(() => ({ items: [] })),
    api.getCategories().catch(() => ({ items: [] })),
    api.getTools().catch(() => ({ items: [] })),
    api.getFoods().catch(() => ({ items: [] })),
  ]);
  return {
    tags: tagData.items, categories: catData.items,
    tools: toolData.items, foods: foodData.items,
  };
}

// Shared by RecipesScreen and CookbookDetailScreen so the tag/category/tool/food
// lists are fetched once per session rather than once per screen.
export function useRecipeFilterOptions() {
  const [options, setOptions] = useState<FilterOptionSets>(optionsCache ?? EMPTY_OPTIONS);
  const [loading, setLoading] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (optionsCache) {
      // Already fetched this session — adopt it without a spinner or a request.
      setOptions(optionsCache);
      return;
    }
    setLoading(true);
    try {
      inFlight = inFlight ?? fetchOptions();
      const result = await inFlight;
      optionsCache = result;
      setOptions(result);
    } catch {
      // Leave the cache empty so the next open retries rather than caching a
      // failure permanently.
      optionsCache = null;
    } finally {
      inFlight = null;
      setLoading(false);
    }
  }, []);

  return { options, loading, ensureLoaded };
}

type ListFilterKey = Exclude<keyof RecipeFilters, 'maxPrepMinutes' | 'maxCookMinutes'>;

export function filterOptionName(options: FilterOptionSets, key: ListFilterKey, value: string): string {
  switch (key) {
    case 'tags': return options.tags.find(t => t.slug === value)?.name ?? value;
    case 'categories': return options.categories.find(c => c.slug === value)?.name ?? value;
    case 'tools': return options.tools.find(t => t.slug === value)?.name ?? value;
    case 'foods': return options.foods.find(f => f.id === value)?.name ?? value;
  }
}
