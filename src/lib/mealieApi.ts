import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  UserProfile, PaginatedResponse, RecipeSummary, Recipe,
  MealPlanEntry, CreateMealPlanEntry,
  ShoppingList, ShoppingListWithItems, ShoppingListItem,
  Cookbook, RecipeTag, RecipeCategory, RecipeComment, ShoppingLabel,
} from '../types';

const SERVER_URL_KEY = 'mealie_go.server_url';
const TOKEN_KEY = 'mealie_go.auth_token';
const SAVED_ACCOUNTS_KEY = 'mealie_go.saved_accounts';

export interface SavedAccount {
  serverUrl: string;
  username: string;
  password: string;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
  return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
}

export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const filtered = accounts.filter(
    a => !(a.serverUrl === account.serverUrl && a.username === account.username)
  );
  filtered.unshift(account);
  await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
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

export function recipeImageUrl(serverUrl: string, slug: string): string {
  return `${serverUrl}/api/media/recipes/${slug}/images/original.webp`;
}

export function recipeImageSource(serverUrl: string, token: string, slug: string) {
  return {
    uri: recipeImageUrl(serverUrl, slug),
    headers: { Authorization: `Bearer ${token}` },
  };
}

export function recipeAssetUrl(serverUrl: string, slug: string, fileName: string): string {
  return `${serverUrl}/api/media/recipes/${slug}/assets/${encodeURIComponent(fileName)}`;
}

export const api = {
  getSelf: () =>
    request<UserProfile>('/api/users/self'),

  // Recipes
  getRecipes: (params?: { page?: number; perPage?: number; search?: string; tags?: string[]; categories?: string[] }) => {
    const q = new URLSearchParams({
      page: String(params?.page ?? 1),
      perPage: String(params?.perPage ?? 50),
      orderBy: 'name',
      orderDirection: 'asc',
    });
    if (params?.search) q.set('search', params.search);
    if (params?.tags?.length) params.tags.forEach(t => q.append('tags', t));
    if (params?.categories?.length) params.categories.forEach(c => q.append('categories', c));
    return request<PaginatedResponse<RecipeSummary>>(`/api/recipes?${q}`);
  },

  getRecipe: (slug: string) =>
    request<Recipe>(`/api/recipes/${slug}`),

  createRecipeFromUrl: (url: string) =>
    request<string>('/api/recipes/create-url', {
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

  getCookbookRecipes: (slug: string, page = 1) =>
    request<PaginatedResponse<RecipeSummary>>(
      `/api/recipes?cookbook=${slug}&page=${page}&perPage=50&orderBy=name&orderDirection=asc`
    ),

  // Organizers (tags, categories)
  getTags: () =>
    request<PaginatedResponse<RecipeTag>>('/api/organizers/tags?perPage=200'),

  getCategories: () =>
    request<PaginatedResponse<RecipeCategory>>('/api/organizers/categories?perPage=200'),

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

  // Add a recipe's ingredients to a shopping list
  addRecipeToShoppingList: (listId: string, recipeId: string) =>
    request<void>(`/api/households/shopping/lists/${listId}/recipe`, {
      method: 'POST',
      body: JSON.stringify({ recipeId }),
    }),

  // Get a random recipe (two requests: first to get total pages, second to fetch random page)
  getRandomRecipe: async (): Promise<RecipeSummary | null> => {
    const first = await request<PaginatedResponse<RecipeSummary>>('/api/recipes?page=1&perPage=1&orderBy=name&orderDirection=asc');
    if (!first.total) return null;
    const randomPage = Math.ceil(Math.random() * first.total_pages);
    const data = await request<PaginatedResponse<RecipeSummary>>(`/api/recipes?page=${randomPage}&perPage=1&orderBy=name&orderDirection=asc`);
    return data.items[0] ?? null;
  },
};
