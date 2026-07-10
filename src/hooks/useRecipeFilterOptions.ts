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

// Shared by RecipesScreen and CookbookDetailScreen so the tag/category/tool/food
// lists (same across the whole server) are only fetched once per screen instance.
export function useRecipeFilterOptions() {
  const [options, setOptions] = useState<FilterOptionSets>(EMPTY_OPTIONS);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const [tagData, catData, toolData, foodData] = await Promise.all([
        api.getTags().catch(() => ({ items: [] })),
        api.getCategories().catch(() => ({ items: [] })),
        api.getTools().catch(() => ({ items: [] })),
        api.getFoods().catch(() => ({ items: [] })),
      ]);
      setOptions({ tags: tagData.items, categories: catData.items, tools: toolData.items, foods: foodData.items });
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  return { options, loading, ensureLoaded };
}

export function filterOptionName(options: FilterOptionSets, key: keyof RecipeFilters, value: string): string {
  switch (key) {
    case 'tags': return options.tags.find(t => t.slug === value)?.name ?? value;
    case 'categories': return options.categories.find(c => c.slug === value)?.name ?? value;
    case 'tools': return options.tools.find(t => t.slug === value)?.name ?? value;
    case 'foods': return options.foods.find(f => f.id === value)?.name ?? value;
  }
}
