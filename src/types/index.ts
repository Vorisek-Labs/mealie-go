export interface UserProfile {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  group: string;
  groupSlug: string;
  household: string;
  admin: boolean;
}

export interface PaginatedResponse<T> {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
}

export interface RecipeTag {
  id?: string;
  name: string;
  slug: string;
}

export interface RecipeCategory {
  id?: string;
  name: string;
  slug: string;
}

export interface RecipeTool {
  id?: string;
  name: string;
  slug: string;
  onHand?: boolean;
}

export interface FoodOrUnitAlias {
  name: string;
}

export interface RecipeUnit {
  id?: string;
  name: string;
  abbreviation?: string;
  aliases?: FoodOrUnitAlias[];
}

export interface RecipeFood {
  id?: string;
  name: string;
  aliases?: FoodOrUnitAlias[];
}

// Minimal create payloads -- Mealie only requires `name` for either.
export interface CreateFoodInput {
  name: string;
}

export interface CreateUnitInput {
  name: string;
}

export interface ParsedIngredientConfidence {
  average?: number;
  comment?: number;
  name?: number;
  unit?: number;
  quantity?: number;
  food?: number;
}

// Result of POST /api/parser/ingredients -- one per input ingredient line.
export interface ParsedIngredient {
  input: string;
  confidence: ParsedIngredientConfidence;
  ingredient: RecipeIngredient;
}

export interface RecipeSummary {
  id: string;
  userId: string;
  groupId: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  recipeYield?: string;
  // Mealie treats "how much this recipe produces" (recipeYield/recipeYieldQuantity,
  // e.g. "8 jars, 0.5 pints each") and "how many people this feeds" (recipeServings)
  // as genuinely separate fields, shown as separate stats in Mealie's own UI —
  // recipeYield is NOT a serving count and shouldn't be parsed as one.
  recipeServings?: number;
  recipeYieldQuantity?: number;
  totalTime?: string;
  prepTime?: string;
  // Mealie's own edit UI writes "Cook Time" to this field, labeled
  // "performTime" internally — `cookTime` below is a separate legacy field
  // only ever populated by recipe-URL imports/migration scrapers, never by
  // hand-editing a recipe in Mealie itself.
  performTime?: string;
  cookTime?: string;
  rating?: number;
  dateAdded?: string;
  lastMade?: string;
  tags: RecipeTag[];
  recipeCategory: RecipeCategory[];
  tools?: RecipeTool[];
}

export interface UserRatingSummary {
  recipeId: string;
  rating?: number;
  isFavorite: boolean;
}

export interface RecipeIngredient {
  title?: string;
  note?: string;
  unit?: RecipeUnit;
  food?: RecipeFood;
  // Confirmed against Mealie's own schema: this field existed on
  // RecipeIngredientBase in v2.x but was removed entirely by v3 -- current
  // Mealie servers never return it and silently ignore it if sent (no
  // extra='forbid' on their Pydantic models). It's still meaningful as a
  // same-session, client-only signal between IngredientParseReviewModal and
  // RecipeEditScreen (before anything is saved), but NEVER trust it on an
  // ingredient that came back from api.getRecipe()/api.updateRecipe() -- it
  // will always be undefined there. Use `!quantity` instead for anything
  // operating on server-loaded data.
  disableAmount?: boolean;
  quantity?: number;
  originalText?: string;
  referenceId?: string;
  display?: string;
}

export interface RecipeInstruction {
  id?: string;
  title?: string;
  text: string;
}

export interface RecipeNote {
  title: string;
  text: string;
}

export interface RecipeNutrition {
  calories?: string;
  fatContent?: string;
  proteinContent?: string;
  carbohydrateContent?: string;
  fiberContent?: string;
  sodiumContent?: string;
  sugarContent?: string;
}

export interface RecipeSettings {
  public: boolean;
  showNutrition: boolean;
  disableComments: boolean;
  locked: boolean;
}

export interface RecipeAsset {
  name: string;
  icon: string;
  fileName: string;
}

export interface RecipeComment {
  id: string;
  recipeId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  user?: { id: string; fullName?: string; username: string };
}

export interface ShoppingLabel {
  id: string;
  groupId: string;
  householdId: string;
  name: string;
  color?: string;
}

export interface Recipe extends RecipeSummary {
  recipeIngredient: RecipeIngredient[];
  recipeInstructions: RecipeInstruction[];
  notes: RecipeNote[];
  assets: RecipeAsset[];
  nutrition?: RecipeNutrition;
  settings?: RecipeSettings;
}

export type MealPlanEntryType = 'breakfast' | 'lunch' | 'dinner' | 'side';

export interface MealPlanEntry {
  id: number;
  groupId: string;
  householdId: string;
  userId: string;
  date: string;
  entryType: MealPlanEntryType;
  title?: string;
  text?: string;
  recipeId?: string;
  recipe?: RecipeSummary;
}

export interface CreateMealPlanEntry {
  date: string;
  entryType: MealPlanEntryType;
  title?: string;
  recipeId?: string;
}

export interface ShoppingList {
  id: string;
  groupId: string;
  householdId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// Per-recipe entry on a shopping list itself -- "this recipe has been added
// to this list N times" (ShoppingListRecipeRefOut server-side). Carries the
// full recipe summary so a chip can show it without a second fetch.
export interface ShoppingListRecipeRef {
  id: string;
  shoppingListId: string;
  recipeId: string;
  recipeQuantity: number;
  recipe: RecipeSummary;
}

export interface ShoppingListWithItems extends ShoppingList {
  listItems: ShoppingListItem[];
  recipeReferences?: ShoppingListRecipeRef[];
}

// Per-ingredient-line recipe attribution (ShoppingListItemRecipeRefOut
// server-side) -- an item can carry more than one of these if the same
// ingredient was pulled in by more than one recipe and got merged.
export interface ShoppingListItemRecipeRef {
  id: string;
  shoppingListItemId: string;
  recipeId: string;
  recipeQuantity: number;
  recipeScale?: number;
  recipeNote?: string;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  checked: boolean;
  position: number;
  note?: string;
  isFood: boolean;
  unit?: RecipeUnit;
  food?: RecipeFood;
  quantity?: number;
  display?: string;
  labelId?: string;
  label?: { id: string; name: string; color?: string };
  recipeReferences?: ShoppingListItemRecipeRef[];
}

export interface Cookbook {
  id: string;
  groupId: string;
  householdId: string;
  name: string;
  description?: string;
  slug: string;
  position: number;
  public: boolean;
  queryFilterString?: string;
}

export interface CookbookInput {
  name: string;
  description?: string;
  public?: boolean;
  position?: number;
  queryFilterString?: string;
}

export interface RecipeShareToken {
  id: string;
  recipeId: string;
  groupId: string;
  expiresAt: string;
  createdAt: string;
  recipe?: Recipe;
}

export interface RecipeSuggestion {
  recipe: RecipeSummary;
  missingFoods: RecipeFood[];
  missingTools: RecipeTool[];
}
