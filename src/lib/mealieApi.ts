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
const PROXY_HEADERS_KEY = 'mealie_go.proxy_headers';
const SAVED_PROXY_HEADERS_KEY = 'mealie_go.saved_proxy_headers';

export interface SavedAccount {
  serverUrl: string;
  username: string;
  password: string;
}

// Custom headers some self-hosted setups require just to reach Mealie at all —
// e.g. a reverse proxy in front of the server gating access with an API key
// header, or Cloudflare Access's CF-Access-Client-Id/Secret pair. Header
// *values* can be secrets (an Access service token, a shared API key), so
// both the active-session copy and the per-server "remembered" copy live in
// expo-secure-store, same reasoning as SavedAccount passwords above.
export interface ProxyHeader {
  name: string;
  value: string;
}

function headersToRecord(headers: ProxyHeader[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const h of headers) {
    // Trim the value too, not just the name -- a pasted API key/token with
    // invisible leading/trailing whitespace (very easy to pick up copying
    // from a web page, terminal, or password manager) would otherwise be
    // sent byte-for-byte wrong, and most reverse proxies do an exact-match
    // check on header values, so a single stray space silently breaks it.
    if (h.name.trim()) record[h.name.trim()] = h.value.trim();
  }
  return record;
}

// Swaps http:// <-> https://, or returns null if the URL doesn't start with
// either (shouldn't happen — ConnectScreen requires one of the two).
function flipUrlScheme(url: string): string | null {
  if (url.startsWith('https://')) return `http://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return null;
}

// Active for the current signed-in session — read fresh on every request,
// independent of the "remember" toggle below (mirrors how the auth token
// itself always persists across app restarts regardless of that toggle).
export async function getProxyHeaders(): Promise<ProxyHeader[]> {
  const raw = await SecureStore.getItemAsync(PROXY_HEADERS_KEY);
  return raw ? (JSON.parse(raw) as ProxyHeader[]) : [];
}

export async function saveProxyHeaders(headers: ProxyHeader[]): Promise<void> {
  if (headers.length === 0) {
    await SecureStore.deleteItemAsync(PROXY_HEADERS_KEY);
    return;
  }
  await SecureStore.setItemAsync(PROXY_HEADERS_KEY, JSON.stringify(headers));
}

async function getSavedProxyHeadersMap(): Promise<Record<string, ProxyHeader[]>> {
  const raw = await SecureStore.getItemAsync(SAVED_PROXY_HEADERS_KEY);
  return raw ? (JSON.parse(raw) as Record<string, ProxyHeader[]>) : {};
}

// Per-server remembered headers, offered back next time that server URL is
// picked from the Connect screen's dropdown — same "remember or not" choice
// as saved account passwords, just keyed by server instead of by account.
export async function getSavedProxyHeadersForServer(serverUrl: string): Promise<ProxyHeader[]> {
  const map = await getSavedProxyHeadersMap();
  return map[serverUrl] ?? [];
}

export async function saveProxyHeadersForServer(serverUrl: string, headers: ProxyHeader[]): Promise<void> {
  const map = await getSavedProxyHeadersMap();
  if (headers.length === 0) {
    delete map[serverUrl];
  } else {
    map[serverUrl] = headers;
  }
  await SecureStore.setItemAsync(SAVED_PROXY_HEADERS_KEY, JSON.stringify(map));
}

export async function removeSavedProxyHeadersForServer(serverUrl: string): Promise<void> {
  const map = await getSavedProxyHeadersMap();
  if (!(serverUrl in map)) return;
  delete map[serverUrl];
  await SecureStore.setItemAsync(SAVED_PROXY_HEADERS_KEY, JSON.stringify(map));
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
  // Session-only — the per-server "remembered" copy (if any) intentionally
  // survives logout, same as saved accounts do.
  await SecureStore.deleteItemAsync(PROXY_HEADERS_KEY);
}

// Mealie's own API never legitimately returns 405 during normal use — every
// route either exists and accepts the method the app sends, or doesn't
// exist at all (confirmed against Mealie's own router/scraper source; even
// a fully-blocked URL-import scrape surfaces as a 400, never a passthrough
// status). So a 405 on a request we built correctly is always a routing
// mismatch, most often a request that got silently redirected and
// downgraded from POST/PUT/DELETE to GET along the way — the default
// behavior of most HTTP clients (including Android's OkHttp under RN's
// fetch) when following a 301/302, which commonly happens when a server
// force-redirects http -> https (via Nginx Proxy Manager, Caddy, Traefik,
// etc.) and the saved server URL still uses the other scheme. A genuine 405
// means the server never actually processed the request, so retrying is
// always safe — this one retry goes straight to the opposite scheme,
// reaching the server directly without needing a redirect at all.
async function retryOnRedirectDowngrade(
  res: Response, serverUrl: string, refetch: (base: string) => Promise<Response>
): Promise<Response> {
  if (res.status !== 405) return res;
  const flipped = flipUrlScheme(serverUrl);
  if (!flipped) return res;
  const retryRes = await refetch(flipped);
  if (retryRes.status === 405) return res;
  await saveServerUrl(flipped);
  return retryRes;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const [serverUrl, token, proxyHeaders] = await Promise.all([getServerUrl(), getToken(), getProxyHeaders()]);
  const headers = {
    ...headersToRecord(proxyHeaders),
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };
  const doFetch = (base: string) => fetch(`${base}${path}`, { ...options, headers });

  const res = await retryOnRedirectDowngrade(await doFetch(serverUrl), serverUrl, doFetch);
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
  const [serverUrl, token, proxyHeaders] = await Promise.all([getServerUrl(), getToken(), getProxyHeaders()]);
  const headers = { ...headersToRecord(proxyHeaders), Authorization: `Bearer ${token}` };
  const doFetch = (base: string) => fetch(`${base}${path}`, { method, headers, body: form });

  const res = await retryOnRedirectDowngrade(await doFetch(serverUrl), serverUrl, doFetch);
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

// Returns the resolved serverUrl alongside the token — see
// retryOnRedirectDowngrade above; the initial URL the user entered may not
// be the one that actually worked (e.g. it force-redirects to the other
// scheme), and the caller needs to persist whichever one actually succeeded.
export async function login(
  serverUrl: string, username: string, password: string, proxyHeaders: ProxyHeader[] = []
): Promise<{ token: string; serverUrl: string }> {
  const base = serverUrl.replace(/\/$/, '');
  const body = new URLSearchParams({ username, password, remember_me: 'false' });
  const headers = {
    ...headersToRecord(proxyHeaders),
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const attempt = (b: string) => fetch(`${b}/api/auth/token`, { method: 'POST', headers, body: body.toString() });

  let res = await attempt(base);
  let resolvedBase = base;
  if (res.status === 405) {
    const flipped = flipUrlScheme(base);
    if (flipped) {
      const retryRes = await attempt(flipped);
      if (retryRes.status !== 405) {
        res = retryRes;
        resolvedBase = flipped;
      }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed: { detail?: unknown } | undefined;
    let isJson = true;
    try {
      parsed = JSON.parse(text);
    } catch {
      isJson = false;
    }

    if (isJson && typeof parsed?.detail === 'string') {
      // A real message from Mealie itself -- e.g. "User is locked out"
      // after too many failed attempts (HTTP 423).
      throw new Error(parsed.detail);
    }
    if (isJson) {
      // Valid JSON but no usable detail -- this is what Mealie's own auth
      // handler returns for a plain wrong username/password (a bare 401
      // with no detail message), so keep the friendly, expected message.
      throw new Error('Invalid username or password');
    }
    // Not JSON at all -- this response didn't come from Mealie's own auth
    // handler, which always returns JSON. Most likely something in front
    // of the server (a reverse proxy, WAF, or load balancer) rejected the
    // request before Mealie ever saw it -- e.g. a missing/wrong proxy
    // header, an IP allowlist, or a block page. Showing "invalid username
    // or password" here would be actively misleading, since the actual
    // credentials were never checked.
    throw new Error(`${res.status}: ${text.slice(0, 300) || res.statusText}`);
  }
  const data = await res.json();
  return { token: data.access_token as string, serverUrl: resolvedBase };
}

export interface AppInfo {
  version: string;
  enableOidc: boolean;
  oidcProviderName: string;
  allowPasswordLogin: boolean;
}

// Unauthenticated -- used on ConnectScreen before any token exists, so it
// can show password fields, an OIDC login button, or both, matching
// whatever the server actually supports (confirmed against Mealie's own
// /api/app/about route and AppInfo schema). Fails soft (returns null) for
// older/unreachable servers rather than blocking the password-login path
// that already worked before this existed.
export async function getAppInfo(serverUrl: string, proxyHeaders: ProxyHeader[] = []): Promise<AppInfo | null> {
  const base = serverUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/app/about`, { headers: headersToRecord(proxyHeaders) });
    if (!res.ok) return null;
    return await res.json() as AppInfo;
  } catch {
    return null;
  }
}

// Mealie's /api/households/* routes (meal plans, shopping lists, cookbooks
// -- core features this app depends on) were introduced in v2.0.0,
// confirmed by diffing Mealie's own route tree across tags; anything older
// can't support large parts of this app. Returns false (no warning) for
// anything that doesn't parse as a leading x.y version, e.g. a "develop"/
// nightly build string, rather than risking a false alarm on an
// unrecognized format.
const MIN_SUPPORTED_MAJOR_VERSION = 2;

export function isOldMealieVersion(version: string | undefined): boolean {
  if (!version) return false;
  const match = /^v?(\d+)\./.exec(version.trim());
  if (!match) return false;
  return parseInt(match[1], 10) < MIN_SUPPORTED_MAJOR_VERSION;
}

// Mealie's own OIDC flow is designed only for its first-party web app: the
// provider's redirect_uri is fixed to Mealie's own {serverUrl}/login (see
// Mealie's OIDC docs -- custom schemes aren't supported), where its SPA
// detects the ?code=&state= callback and completes the exchange itself.
// Rather than reimplementing that exchange, the app lets the real flow run
// untouched inside a WebView, then confirms the resulting session
// server-side -- see OidcLoginModal.tsx for the detection strategy and why
// it deliberately never reads the session cookie directly (cookie
// mechanics differ across Mealie versions; the earlier cookie-reading
// approach failed in the field).
export const OIDC_LOGIN_PATH = '/api/auth/oauth';

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

  // Comments live under a top-level /api/comments router, NOT nested under
  // /api/recipes -- confirmed against Mealie's actual router registration
  // (`APIRouter(prefix="/comments", ...)`), which only mounts a GET for
  // listing a recipe's comments under /api/recipes/{slug}/comments (see
  // getComments above); create/delete are both under /api/comments itself.
  // The old /api/recipes/comments path here doesn't exist on any Mealie
  // version and would 404/405 every time -- this was never exercised
  // against a live server before shipping.
  addComment: (recipeId: string, text: string) =>
    request<RecipeComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ recipeId, text }),
    }),

  deleteComment: (commentId: string) =>
    request<void>(`/api/comments/${commentId}`, { method: 'DELETE' }),

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

  // Removes (or decrements, if the recipe was added more than once) exactly
  // the ingredients this recipe contributed to the list -- confirmed against
  // Mealie's own route (`POST .../lists/{id}/recipe/{recipe_id}/delete`,
  // NOT the deprecated singular add route of a similar shape) and its
  // `ShoppingListRemoveRecipeParams` schema (`recipeDecrementQuantity`).
  removeRecipeFromShoppingList: (listId: string, recipeId: string, decrementQuantity = 1) =>
    request<ShoppingListWithItems>(`/api/households/shopping/lists/${listId}/recipe/${recipeId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ recipeDecrementQuantity: decrementQuantity }),
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
