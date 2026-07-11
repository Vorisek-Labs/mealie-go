import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  UserProfile, PaginatedResponse, RecipeSummary, Recipe,
  MealPlanEntry, CreateMealPlanEntry,
  ShoppingList, ShoppingListWithItems, ShoppingListItem,
  Cookbook, CookbookInput, RecipeTag, RecipeCategory, RecipeTool, RecipeUnit, RecipeFood,
  CreateFoodInput, CreateUnitInput, ParsedIngredient, RecipeComment, ShoppingLabel,
  UserRatingSummary, RecipeShareToken, RecipeSuggestion,
} from '../types';

const SERVER_URL_KEY = 'mealie_go.server_url';
const TOKEN_KEY = 'mealie_go.auth_token';
const SAVED_ACCOUNTS_KEY = 'mealie_go.saved_accounts';

export interface SavedAccount {
  serverUrl: string;
  username: string;
  password: string;
}

// Saved accounts include plaintext passwords (so the login form can
// autofill them), so this list lives in expo-secure-store (Android
// Keystore-encrypted, and excluded from Android's app-data backups) —
// NOT AsyncStorage, which is neither encrypted nor backup-excluded.
export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(SAVED_ACCOUNTS_KEY);
  if (raw) return JSON.parse(raw) as SavedAccount[];

  // One-time migration for installs that saved this list before the fix
  // above: move it out of plaintext AsyncStorage and wipe the old copy.
  const legacy = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
  if (!legacy) return [];
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, legacy);
  await AsyncStorage.removeItem(SAVED_ACCOUNTS_KEY);
  return JSON.parse(legacy) as SavedAccount[];
}

export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(
    a => !(a.serverUrl === account.serverUrl && a.username === account.username)
  );
  filtered.unshift(account);
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
}

// Used when someone signs in with "Remember this account" turned off — if a
// password for that exact server + username was saved from an earlier login,
// leaving it in place would make the toggle a lie.
export async function removeAccount(serverUrl: string, username: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(a => !(a.serverUrl === serverUrl && a.username === username));
  if (filtered.length === accounts.length) return;
  await SecureStore.setItemAsync(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
}

export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_URL_KEY)) ?? '';
}

export async function saveServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ''));
}

export async function getToken(): Promise<string> {
  return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '';
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(SERVER_URL_KEY);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const [serverUrl, token] = await Promise.all([getServerUrl(), getToken()]);
  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// Multipart uploads must NOT set a Content-Type header — fetch derives the
// multipart/form-data boundary itself from the FormData body.
async function requestMultipart<T>(path: string, method: string, form: FormData): Promise<T> {
  const [serverUrl, token] = await Promise.all([getServerUrl(), getToken()]);
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return (match?.[1] ?? 'jpg').toLowerCase();
}

function mimeTypeForExtension(ext: string): string {
  const known: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
    csv: 'text/csv', json: 'application/json',
  };
  return known[ext] ?? 'application/octet-stream';
}

export function assetIconForExtension(ext: string): string {
  if (ext === 'pdf') return 'mdi-file-pdf-box';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(ext)) return 'mdi-file-image';
  if (ext === 'json') return 'mdi-code-json';
  return 'mdi-file';
}

export interface RecipeQueryParams {
  page?: number; perPage?: number; search?: string;
  tags?: string[]; categories?: string[]; tools?: string[]; foods?: string[];
  // Recipes within a single cookbook — combines with the filters above in the
  // same request (confirmed against Mealie's recipe list route).
  cookbook?: string;
}

function buildRecipeQuery(params?: RecipeQueryParams): URLSearchParams {
  const q = new URLSearchParams({
    page: String(params?.page ?? 1),
    perPage: String(params?.perPage ?? 50),
    orderBy: 'name',
    orderDirection: 'asc',
  });
  if (params?.search) q.set('search', params.search);
  if (params?.cookbook) q.set('cookbook', params.cookbook);
  if (params?.tags?.length) params.tags.forEach(t => q.append('tags', t));
  if (params?.categories?.length) params.categories.forEach(c => q.append('categories', c));
  if (params?.tools?.length) params.tools.forEach(t => q.append('tools', t));
  // foods must be UUIDs (foods have no slug)
  if (params?.foods?.length) params.foods.forEach(f => q.append('foods', f));
  return q;
}

export async function login(serverUrl: string, username: string, password: string): Promise<string> {
  const base = serverUrl.replace(/\/$/, '');
  const body = new URLSearchParams({ username, password, remember_me: 'false' });
  const res = await fetch(`${base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? 'Invalid username or password');
  }
  const data = await res.json();
  return data.access_token as string;
}

// Media endpoints take the recipe UUID (recipe.id), NOT the slug —
// passing a slug returns a 422 UUID-parse error from the server.
// `version` busts the RN Image cache after a new image is uploaded.
export function recipeImageUrl(serverUrl: string, recipeId: string, version?: string): string {
  const base = `${serverUrl}/api/media/recipes/${recipeId}/images/original.webp`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function recipeImageSource(serverUrl: string, token: string, recipeId: string, version?: string) {
  return {
    uri: recipeImageUrl(serverUrl, recipeId, version),
    headers: { Authorization: `Bearer ${token}` },
  };
}

export function recipeAssetUrl(serverUrl: string, recipeId: string, fileName: string): string {
  return `${serverUrl}/api/media/recipes/${recipeId}/assets/${encodeURIComponent(fileName)}`;
}

export const api = {
  getSelf: () =>
    request<UserProfile>('/api/users/self'),

  // Refresh a still-valid JWT for a new one with a fresh expiry.
  // Only works while the current token is still valid — an already-expired
  // token can't be refreshed (the server must decode it to issue a new one).
  refreshToken: () =>
    request<{ access_token: string }>('/api/auth/refresh'),

  // Favorites & ratings (per-user; distinct from the recipe's own aggregate rating)
  getFavoriteRecipeIds: (userId: string) =>
    request<{ ratings: UserRatingSummary[] }>(`/api/users/${userId}/favorites`)
      .then(r => new Set(r.ratings.map(x => x.recipeId))),

  addFavorite: (userId: string, slug: string) =>
    request<void>(`/api/users/${userId}/favorites/${slug}`, { method: 'POST' }),

  removeFavorite: (userId: string, slug: string) =>
    request<void>(`/api/users/${userId}/favorites/${slug}`, { method: 'DELETE' }),

  // Recipe share tokens (public links)
  getShareTokens: (recipeId: string) =>
    request<RecipeShareToken[]>(`/api/shared/recipes?recipe_id=${recipeId}`),

  createShareToken: (recipeId: string, expiresAt?: string) =>
    request<RecipeShareToken>('/api/shared/recipes', {
      method: 'POST',
      body: JSON.stringify({
        recipeId,
        expiresAt: expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }),

  deleteShareToken: (id: string) =>
    request<void>(`/api/shared/recipes/${id}`, { method: 'DELETE' }),

  // Recipes
  getRecipes: (params?: RecipeQueryParams) =>
    request<PaginatedResponse<RecipeSummary>>(`/api/recipes?${buildRecipeQuery(params)}`),

  getRecipe: (slug: string) =>
    request<Recipe>(`/api/recipes/${slug}`),

  // Current Mealie versions moved this from the old flat "/create-url" path
  // to "/create/url" (grouped alongside the streaming and bulk URL-import
  // variants) -- the old path now gets matched by the /recipes/{slug} route
  // instead (treating "create-url" as a slug), which doesn't support POST,
  // hence a 405 rather than a 404.
  createRecipeFromUrl: (url: string) =>
    request<string>('/api/recipes/create/url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  createRecipe: (name: string) =>
    request<string>('/api/recipes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateRecipe: (slug: string, data: Partial<Recipe>) =>
    request<Recipe>(`/api/recipes/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRecipe: (slug: string) =>
    request<void>(`/api/recipes/${slug}`, { method: 'DELETE' }),

  // Recipe image (multipart) — returns { image: <newVersion> }
  updateRecipeImage: (slug: string, fileUri: string) => {
    const extension = extensionFromUri(fileUri);
    const form = new FormData();
    form.append('image', {
      uri: fileUri,
      name: `image.${extension}`,
      type: mimeTypeForExtension(extension),
    } as unknown as Blob);
    form.append('extension', extension);
    return requestMultipart<{ image: string }>(`/api/recipes/${slug}/image`, 'PUT', form);
  },

  // Recipe attachment (multipart)
  uploadRecipeAsset: (slug: string, fileUri: string, name: string) => {
    const extension = extensionFromUri(fileUri);
    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: `${name}.${extension}`,
      type: mimeTypeForExtension(extension),
    } as unknown as Blob);
    form.append('name', name);
    form.append('icon', assetIconForExtension(extension));
    form.append('extension', extension);
    return requestMultipart<{ name: string; icon: string; fileName: string }>(
      `/api/recipes/${slug}/assets`, 'POST', form
    );
  },

  // Meal plans
  getMealPlans: (startDate?: string, endDate?: string) => {
    const q = new URLSearchParams({ perPage: '100' });
    if (startDate) q.set('start_date', startDate);
    if (endDate) q.set('end_date', endDate);
    return request<PaginatedResponse<MealPlanEntry>>(`/api/households/mealplans?${q}`);
  },

  getTodayMeals: () =>
    request<MealPlanEntry[]>('/api/households/mealplans/today'),

  createMealPlan: (data: CreateMealPlanEntry) =>
    request<MealPlanEntry>('/api/households/mealplans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteMealPlan: (id: number) =>
    request<void>(`/api/households/mealplans/${id}`, { method: 'DELETE' }),

  // Shopping lists
  getShoppingLists: () =>
    request<PaginatedResponse<ShoppingList>>('/api/households/shopping/lists?perPage=50'),

  getShoppingList: (id: string) =>
    request<ShoppingListWithItems>(`/api/households/shopping/lists/${id}`),

  createShoppingList: (name: string) =>
    request<ShoppingList>('/api/households/shopping/lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteShoppingList: (id: string) =>
    request<void>(`/api/households/shopping/lists/${id}`, { method: 'DELETE' }),

  addShoppingItem: (shoppingListId: string, note: string, quantity?: number, labelId?: string) =>
    request<ShoppingListItem>('/api/households/shopping/items', {
      method: 'POST',
      body: JSON.stringify({
        shoppingListId,
        note,
        isFood: false,
        checked: false,
        ...(quantity ? { quantity } : {}),
        ...(labelId ? { labelId } : {}),
      }),
    }),

  updateShoppingItem: (itemId: string, data: Partial<ShoppingListItem>) =>
    request<ShoppingListItem>(`/api/households/shopping/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteShoppingItem: (itemId: string) =>
    request<void>(`/api/households/shopping/items/${itemId}`, { method: 'DELETE' }),

  // Cookbooks
  getCookbooks: () =>
    request<PaginatedResponse<Cookbook>>('/api/households/cookbooks?perPage=50'),

  createCookbook: (data: CookbookInput) =>
    request<Cookbook>('/api/households/cookbooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCookbook: (id: string, data: CookbookInput) =>
    request<Cookbook>(`/api/households/cookbooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCookbook: (id: string) =>
    request<void>(`/api/households/cookbooks/${id}`, { method: 'DELETE' }),

  // Organizers (tags, categories)
  getTags: () =>
    request<PaginatedResponse<RecipeTag>>('/api/organizers/tags?perPage=200'),

  getCategories: () =>
    request<PaginatedResponse<RecipeCategory>>('/api/organizers/categories?perPage=200'),

  getTools: () =>
    request<PaginatedResponse<RecipeTool>>('/api/organizers/tools?perPage=200'),

  getFoods: (search?: string) => {
    const q = new URLSearchParams({ perPage: search ? '50' : '1000', orderBy: 'name', orderDirection: 'asc' });
    if (search) q.set('search', search);
    return request<PaginatedResponse<RecipeFood>>(`/api/foods?${q}`);
  },

  createFood: (data: CreateFoodInput) =>
    request<RecipeFood>('/api/foods', { method: 'POST', body: JSON.stringify(data) }),

  updateFood: (id: string, data: RecipeFood) =>
    request<RecipeFood>(`/api/foods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getUnits: (search?: string) => {
    const q = new URLSearchParams({ perPage: search ? '50' : '200', orderBy: 'name', orderDirection: 'asc' });
    if (search) q.set('search', search);
    return request<PaginatedResponse<RecipeUnit>>(`/api/units?${q}`);
  },

  createUnit: (data: CreateUnitInput) =>
    request<RecipeUnit>('/api/units', { method: 'POST', body: JSON.stringify(data) }),

  updateUnit: (id: string, data: RecipeUnit) =>
    request<RecipeUnit>(`/api/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Turns freeform ingredient text into structured quantity/unit/food guesses
  // with a confidence score per line. "nlp" is Mealie's own bundled parser —
  // unlike AI image/URL features, this needs no external provider configured
  // and works on any self-hosted server out of the box.
  parseIngredients: (ingredients: string[], parser: 'nlp' | 'brute' = 'nlp') =>
    request<ParsedIngredient[]>('/api/parser/ingredients', {
      method: 'POST',
      body: JSON.stringify({ parser, ingredients }),
    }),

  // Multipart image-to-recipe creation. Requires the server's group to have
  // an AI provider configured (OpenAI-compatible) -- callers must catch and
  // handle the "not enabled" error gracefully, this is not available on a
  // default/unconfigured Mealie install.
  createRecipeFromImages: (imageUris: string[], translateLanguage?: string) => {
    const form = new FormData();
    imageUris.forEach((uri, i) => {
      const extension = extensionFromUri(uri);
      form.append('images', {
        uri,
        name: `image_${i}.${extension}`,
        type: mimeTypeForExtension(extension),
      } as unknown as Blob);
    });
    const q = translateLanguage ? `?translateLanguage=${encodeURIComponent(translateLanguage)}` : '';
    return requestMultipart<string>(`/api/recipes/create/image${q}`, 'POST', form);
  },

  // Comments
  getComments: (slug: string) =>
    request<RecipeComment[]>(`/api/recipes/${slug}/comments`),

  addComment: (recipeId: string, text: string) =>
    request<RecipeComment>('/api/recipes/comments', {
      method: 'POST',
      body: JSON.stringify({ recipeId, text }),
    }),

  deleteComment: (commentId: string) =>
    request<void>(`/api/recipes/comments/${commentId}`, { method: 'DELETE' }),

  // Shopping labels
  getShoppingLabels: () =>
    request<PaginatedResponse<ShoppingLabel>>('/api/households/shopping/labels?perPage=100'),

  // Add one or more recipes' ingredients to a shopping list in a single request.
  // The endpoint takes a JSON array even for one recipe — omitting
  // recipeIngredients lets the server pull each recipe's full ingredient list itself.
  addRecipesToShoppingList: (listId: string, recipeIds: string[]) =>
    request<ShoppingListWithItems>(`/api/households/shopping/lists/${listId}/recipe`, {
      method: 'POST',
      body: JSON.stringify(recipeIds.map(recipeId => ({ recipeId, recipeIncrementQuantity: 1 }))),
    }),

  // "What can I make?" — suggests recipes from foods/tools you have on hand.
  getRecipeSuggestions: (params: { foods?: string[]; tools?: string[]; limit?: number }) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 20));
    params.foods?.forEach(f => q.append('foods', f));
    params.tools?.forEach(t => q.append('tools', t));
    return request<{ items: RecipeSuggestion[] }>(`/api/recipes/suggestions?${q}`);
  },

  // Get a random recipe (two requests: first to get total pages, second to fetch random page).
  // Accepts the same filter/cookbook params as getRecipes to scope the pick.
  getRandomRecipe: async (params?: Omit<RecipeQueryParams, 'page' | 'perPage'>): Promise<RecipeSummary | null> => {
    const first = await request<PaginatedResponse<RecipeSummary>>(`/api/recipes?${buildRecipeQuery({ ...params, page: 1, perPage: 1 })}`);
    if (!first.total) return null;
    const randomPage = Math.ceil(Math.random() * first.total_pages);
    const data = await request<PaginatedResponse<RecipeSummary>>(`/api/recipes?${buildRecipeQuery({ ...params, page: randomPage, perPage: 1 })}`);
    return data.items[0] ?? null;
  },
};
