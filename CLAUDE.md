# Mealie Go — Claude Code Briefing Document

Read this entire file at the start of every session before writing any code.
This is the single source of truth for the project.

---

## What is Mealie Go?

Mealie Go is a mobile Android app (React Native + Expo) for the self-hosted recipe manager Mealie.
It lets you and your friends/family browse recipes, plan meals, manage shopping lists, and browse cookbooks — all from your phone, connected to any self-hosted Mealie server.

Target platforms: Android (primary), iOS (secondary).
One codebase via React Native + Expo targeting both.

Play Store package: `com.voriseklabs.mealiego`

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React Native + Expo (TypeScript) | `blank-typescript` template |
| Navigation | React Navigation v7 | Bottom tabs + nested native stack navigators |
| Auth / API | Mealie REST API directly | No Supabase — Mealie server IS the backend |
| Token storage | `expo-secure-store` | Auth JWT encrypted at rest |
| Server URL storage | `@react-native-async-storage/async-storage` | Plain AsyncStorage |
| State | React Context + hooks | No Redux |
| Image auth | `{ uri, headers }` on Image source | Mealie images require Bearer token header |
| Build | ADB local builds | Same pattern as GuitarVault and Kindling |

---

## Key Architectural Decision: No Supabase

Unlike GuitarVault and Kindling, this app has NO Supabase backend.
The user's self-hosted Mealie server IS the backend for everything.

Auth flow:
1. User enters server URL + username + password on ConnectScreen
2. App POSTs to `/api/auth/token` (form data, NOT JSON) → gets JWT
3. JWT stored in `expo-secure-store`, server URL in AsyncStorage
4. All API calls use `Authorization: Bearer <token>` header
5. On next app launch, loads saved URL + token, verifies with `GET /api/users/self`

Multi-server: if a friend runs their own Mealie server, they point the app at their URL. App supports one active server at a time (the one they logged into). To switch servers, sign out and reconnect.

---

## Mealie Auth Endpoint (CRITICAL)

```
POST /api/auth/token
Content-Type: application/x-www-form-urlencoded       ← NOT JSON, form data

username=<username>&password=<password>&remember_me=false
```

Response: `{ "access_token": "...", "token_type": "bearer" }`

This is in `src/lib/mealieApi.ts` → `login()` function.

---

## Project Structure

```
MealieGo/
├── CLAUDE.md                      ← this file
├── app.json
├── App.tsx                        ← AuthProvider + StatusBar + RootNavigator
├── package.json
├── tsconfig.json
├── babel.config.js
├── assets/
│   ├── icon.png                   ← copy from Kindling to bootstrap, replace later
│   ├── adaptive-icon.png
│   ├── splash.png
│   └── favicon.png
└── src/
    ├── theme/
    │   └── index.ts               ← herb green palette, all color/spacing/typography tokens
    ├── i18n/
    │   ├── index.ts               ← i18next setup: initI18n(), setLanguage(), SUPPORTED_LANGUAGES, RTL_LANGUAGES
    │   └── locales/*.json         ← per-language strings, en.json is the source of truth for keys; only
    │                                 ConnectScreen + SettingsScreen migrated so far (added 2026-07-18) — most
    │                                 screens still use hardcoded English strings, see Localization section below
    ├── types/
    │   └── index.ts               ← all TypeScript interfaces (Recipe, MealPlan, Shopping, etc.)
    ├── lib/
    │   ├── mealieApi.ts           ← Mealie API client: login(), api.*, recipeImageSource()
    │   ├── unitConversion.ts      ← client-side metric⇄original ingredient/temperature conversion
    │   └── onboarding.ts          ← device-level "has seen welcome screen" flag (AsyncStorage)
    ├── context/
    │   ├── AuthContext.tsx        ← user, serverUrl, token, loading, signIn(), logout(), silent token refresh
    │   └── FavoritesContext.tsx   ← per-user favorite recipe ids, isFavorite(), toggleFavorite()
    ├── hooks/
    │   ├── useRecipes.ts          ← list + search + pagination + tags/categories/tools/foods filters
    │   ├── useMealPlan.ts         ← week-bounded meal plan entries
    │   ├── useShoppingLists.ts    ← lists + useShoppingListDetail (items, toggle, delete)
    │   └── useCookbooks.ts        ← cookbooks + cookbook recipes + create/update/delete
    ├── navigation/
    │   ├── RootNavigator.tsx      ← auth gate → root stack (Welcome/MainTabs/Guide modal) → 5-tab navigator + nested stacks
    │   └── navigateToGuide.ts     ← walks up parent navigators to reach the root-level Guide screen
    ├── components/
    │   ├── RecipeCard.tsx         ← card with auth-gated image + favorite heart, calls useAuth()/useFavorites()
    │   └── EmptyState.tsx         ← icon + title + subtitle
    └── screens/
        ├── auth/
        │   └── ConnectScreen.tsx  ← server URL + username + password → login
        ├── WelcomeScreen.tsx      ← first-launch-only screen (root stack), "View Guide" or "Continue to App"
        ├── GuideScreen.tsx        ← root-level modal, quick-reference sections, scrolls to a section via route param
        ├── RecipesScreen.tsx      ← list, search, tag/category/tool/food filters, favorites-only toggle (full-server, not just loaded page), 🎲 random, 🥕 → Suggestions
        ├── RecipeDetailScreen.tsx ← hero image (upload), tabs, favorite, share links, unit toggle, PDF export, add-to-shopping-list
        ├── RecipeEditScreen.tsx   ← full edit form: name/desc/times/ingredients/steps/tags/categories/notes
        ├── RecipeSuggestionsScreen.tsx   ← "What can I make?" — pick foods/tools on hand, see matching recipes, Clear All
        ├── AddRecipeScreen.tsx    ← modal: import URL or create manually
        ├── MealPlanScreen.tsx     ← week strip + day entries by meal type, add/remove entries, "?" → Guide
        ├── ShoppingListsScreen.tsx       ← list of shopping lists, "?" → Guide
        ├── ShoppingListDetailScreen.tsx  ← items with check-off + add bar, add from meal plan or from multi-selected recipes
        ├── CookbooksScreen.tsx    ← 2-col grid, create/edit/delete cookbooks
        ├── CookbookDetailScreen.tsx      ← recipes in a cookbook, same search/filter/🎲 random as main Recipes list (uses useRecipes(slug))
        └── SettingsScreen.tsx     ← server info, user info, unit system preference, guide link, sign out
```

### Shared recipe list/filter pieces (used by both RecipesScreen and CookbookDetailScreen)
- `hooks/useRecipes.ts` — takes an optional `cookbookSlug` to scope every fetch to one cookbook.
- `hooks/useRecipeFilterOptions.ts` — lazy-loads tags/categories/tools/foods once; exports
  `filterOptionName()` for turning a filter's slug/id back into a display name.
- `components/RecipeFilterModal.tsx` — the tag/category/tool/food picker modal, fully controlled
  (`visible/loading/options/filters/onApply/onClose`), used identically by both screens.
- `components/ActiveFilterChips.tsx` — the removable pill row shown under the search bar.
- `api.getRecipes()` / `api.getRandomRecipe()` both take an optional `cookbook` param that combines
  with `tags`/`categories`/`tools`/`foods`/`search` in the same request (confirmed against Mealie's
  recipe list route — cookbook and the organizer filters aren't mutually exclusive).

---

## Design System

### Theme — Warm Terracotta/Orange, Dark Mode First

The palette actually shipped (in `src/theme/index.ts`) is a warm orange-on-near-black scheme
matching the app icon, not the herb-green palette originally planned here — this doc previously
described the wrong colors. Current values:

```typescript
// src/theme/index.ts
colors.background      = '#0F0D0A'
colors.surface         = '#1A1510'
colors.surfaceElevated = '#251C14'

colors.primary         = '#E87830'   // orange
colors.primaryLight    = '#F09850'
colors.primaryDark     = '#C45C18'
colors.accent          = '#4E9E8C'   // muted teal

colors.textPrimary     = '#F4F0EC'
colors.textSecondary   = '#9A8070'
colors.textDisabled    = '#52403A'
colors.textInverse     = '#0F0D0A'

colors.tabBarActive    = '#E87830'
colors.tabBarInactive  = '#4A3428'
```

### Navigation — Root Stack → 5 Bottom Tabs + Nested Stacks

`RootNavigator` is a root-level stack (`Welcome` / `MainTabs` / `Guide`) sitting above the tab
navigator, not just the tab navigator directly — this exists so the onboarding Welcome screen and
the Guide modal can be reached from anywhere without living inside any one tab. `Welcome` is only
ever the initial route on a fresh install (see Onboarding section below); everyday app usage
mounts straight into `MainTabs`.

| Tab | Stack screens |
|---|---|
| Recipes 🍽️ | RecipesList → RecipeDetail, AddRecipe (modal), RecipeEdit |
| Meal Plan 📅 | Single screen (no nested stack) |
| Shopping 🛒 | ShoppingLists → ShoppingListDetail |
| Cookbooks 📖 | CookbooksList → CookbookDetail |
| Settings ⚙️ | Single screen |

### Onboarding (Welcome + Guide)
- **Welcome screen**: shown once, immediately after an explicit sign-in — never for a session
  auto-restored from a saved token on cold start (gated on `AuthContext.justSignedIn`, in-memory
  only, true only inside `signIn()`), AND only if never dismissed before (AsyncStorage flag in
  `lib/onboarding.ts`, device-level — not tied to any one account, so signing out and into a
  different server won't show it again). Both conditions must hold: `showWelcome = justSignedIn
  && !hasSeenWelcome`. Buttons: "View Quick Guide" (→ Guide, with `MainTabs` underneath so closing
  it lands in the app) or "Continue to App".
- **Guide screen**: reachable any time from Settings ("How to Use Mealie Go"), and from small "?"
  buttons on MealPlanScreen and ShoppingListsScreen headers that jump straight to that section.
  Implemented as a `RootStack` modal; `navigateToGuide(navigation, section?)` walks up parent
  navigators via `getParent()` until it finds the one with `Guide` in its route names, so it works
  correctly from screens nested inside a tab's own stack, not just flat tab screens.
- To add a new guide section: add an entry to `SECTIONS` in `GuideScreen.tsx` and to the
  `GuideSection` union in `navigateToGuide.ts`.

---

## API Reference (Mealie v3.x)

All requests: `Authorization: Bearer <token>`, `Content-Type: application/json`.
Base URL: whatever the user entered on ConnectScreen.

### Recipes
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes` | `?page=1&perPage=50&search=&orderBy=name` — filters: repeatable `categories=`, `tags=`, `tools=` (slugs) and `foods=` (**UUIDs** — foods have no slug) |
| GET | `/api/recipes/{slug}` | Full recipe with ingredients + instructions |
| POST | `/api/recipes` | Body: `{ name }` → returns slug string |
| POST | `/api/recipes/create/url` | Body: `{ url }` → returns slug string. **Not** `/create-url` (the old path) — current Mealie versions moved this under `/create/url`, grouped with the streaming (`/create/url/stream`) and bulk (`/create/url/bulk`) variants; the old flat path now gets matched by `/recipes/{slug}` instead (treating "create-url" as a slug), which returns 405 since that route doesn't support POST. |
| PUT | `/api/recipes/{slug}` | Full recipe body |
| DELETE | `/api/recipes/{slug}` | |

**`RecipeIngredient.disableAmount` does not exist on Mealie v3+** — confirmed against Mealie's own
schema (`RecipeIngredientBase` in `mealie/schema/recipe/recipe_ingredient.py`): this field was
present in v2.x but removed entirely by v3. Current servers never return it, and silently ignore it
if sent (Mealie's Pydantic models don't set `extra='forbid'`). Fixed 2026-07-18 after this caused
dead/misleading logic in three places that treated it as if it reliably reflected server state after
a reload (it never does — `!quantity` is the only signal that actually survives a round-trip). It's
still legitimately used as a same-session, client-only signal between `IngredientParseReviewModal`
and `RecipeEditScreen`, before anything is saved — that usage is fine and was left alone. If you're
tempted to read `ing.disableAmount` on anything that came from `api.getRecipe()` or
`api.updateRecipe()`, don't — it will always be `undefined` there.

### Images & Assets (CRITICAL: use recipe UUID, not slug)
`{serverUrl}/api/media/recipes/{recipeId}/images/original.webp`
`{serverUrl}/api/media/recipes/{recipeId}/assets/{fileName}`
Media endpoints take the recipe **UUID** (`recipe.id`), NOT the slug — a slug returns a 422
"input should be a valid uuid" error. Use `recipeImageSource(serverUrl, token, recipe.id, recipe.image)`
from `mealieApi.ts` which returns `{ uri, headers }` for the Image source prop — the 4th arg
(`recipe.image`, Mealie's own cache-key/version string) busts the RN Image cache after a re-upload.

| Method | Path | Notes |
|---|---|---|
| PUT | `/api/recipes/{slug}/image` | Multipart: `image` (file) + `extension` (form field). Returns `{ image: <newVersion> }`. Uses **slug** here, unlike the read path above. |
| POST | `/api/recipes/{slug}/assets` | Multipart: `name`, `icon` (mdi-* string), `extension`, `file`. Returns `RecipeAsset`. |

### Favorites & Ratings (per-user, NOT the same as `recipe.rating`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/users/{userId}/favorites` | Returns `{ ratings: [{ recipeId, rating, isFavorite }] }` |
| POST/DELETE | `/api/users/{userId}/favorites/{slug}` | Add/remove favorite |

Note: `recipe.rating` (used by the existing star-rating UI via `PUT /api/recipes/{slug}`) is a
separate, older field from the per-user favorites/ratings system above. Left as-is since it's
shipped and working — don't conflate the two without testing against a live server first.

### Share Links (public, no-login recipe view)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/shared/recipes?recipe_id=` | List this recipe's share tokens |
| POST | `/api/shared/recipes` | Body: `{ recipeId, expiresAt }` (ISO date, defaults to +30 days) |
| DELETE | `/api/shared/recipes/{id}` | Revoke a share link |

Public link format for recipients (Vue SPA route, not an API route):
`{serverUrl}/g/{groupSlug}/shared/r/{tokenId}` — `groupSlug` comes from `UserProfile.groupSlug`
(`GET /api/users/self` field `group_slug`).

### Meal Plans
| Method | Path | Notes |
|---|---|---|
| GET | `/api/households/mealplans` | `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&perPage=100` |
| GET | `/api/households/mealplans/today` | Returns array (not paginated) |
| POST | `/api/households/mealplans` | Body: `{ date, entryType, title?, recipeId? }` |
| DELETE | `/api/households/mealplans/{id}` | id is a number |

### Shopping Lists
| Method | Path | Notes |
|---|---|---|
| GET | `/api/households/shopping/lists` | `?perPage=50` |
| GET | `/api/households/shopping/lists/{id}` | Returns list + `listItems` array |
| POST | `/api/households/shopping/lists` | Body: `{ name }` |
| DELETE | `/api/households/shopping/lists/{id}` | |
| POST | `/api/households/shopping/items` | Body: `{ shoppingListId, note, isFood, checked }` |
| PUT | `/api/households/shopping/items/{id}` | Full item body to update |
| DELETE | `/api/households/shopping/items/{id}` | |
| POST | `/api/households/shopping/lists/{id}/recipe` | **Body is a JSON array**, even for one recipe: `[{ recipeId, recipeIncrementQuantity }]`. Omit `recipeIngredients` and the server pulls each recipe's full ingredient list itself. The original code here sent a bare object instead of an array — would have 422'd the first time it was actually exercised; fixed as `api.addRecipesToShoppingList()`. There's also a deprecated singular `/recipe/{recipe_id}` route; don't use it, the bulk one replaces it. |

### Recipe Suggestions ("What can I make?")
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes/suggestions?foods=&tools=&limit=` | `foods`/`tools` are repeatable UUID query params (the ones the user picked for this query). Returns `{ items: [{ recipe, missingFoods, missingTools }] }`. Also honors persistent per-household "on hand" flags (`includeFoodsOnHand`/`includeToolsOnHand`, default true) — we don't expose a UI for setting persistent on-hand status, only the per-query food/tool picker in `RecipeSuggestionsScreen`. |

### Organizers (filter option lists)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/organizers/tags` | `?perPage=200` |
| GET | `/api/organizers/categories` | `?perPage=200` |
| GET | `/api/organizers/tools` | `?perPage=200` |
| GET | `/api/foods` | `?perPage=1000` — filter by `foods=` uses the food **id** (UUID) |

### Cookbooks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/households/cookbooks` | `?perPage=50` |
| GET | `/api/recipes?cookbook={slug}` | Recipes in a cookbook |
| POST | `/api/households/cookbooks` | Body (`CookbookInput`): `{ name, description, public, position, queryFilterString }` |
| PUT | `/api/households/cookbooks/{id}` | **Full replace**, not a patch — resend all fields |
| DELETE | `/api/households/cookbooks/{id}` | |

Mealie's newer cookbooks are backed by a `queryFilterString` (query-builder syntax) rather than a
manual recipe list. We don't build a query-filter UI — cookbooks created in-app default to an
empty filter string, same as the "no filter" default.

### Auth / User
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/token` | Form data (NOT JSON): `username, password, remember_me` |
| GET | `/api/users/self` | Returns UserProfile (includes `groupSlug`, used for share links) |
| GET | `/api/auth/refresh` | Re-signs a **still-valid** token for a fresh one. Cannot recover an already-expired token — must be called proactively, not reactively on 401. `AuthContext` calls this every 6h and on app-foreground. |
| GET | `/api/app/about` | **Unauthenticated.** Returns `AppInfo`: `version`, `enableOidc`, `oidcProviderName`, `allowPasswordLogin`. `ConnectScreen` calls this on server-URL blur (`getAppInfo()` in `mealieApi.ts`) to decide whether to show password fields, an OIDC button, or both — fails soft to `null` (password fields shown) on any error so it can never regress the existing login path. |
| GET | `/api/auth/oauth` | Kicks off Mealie's server-side OIDC redirect. See "SSO / OIDC login" below — opened in an embedded WebView, not called directly. |

### Comments
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes/{slug}/comments` | List a recipe's comments |
| POST | `/api/comments` | Body: `{ recipeId, text }`. **Not** `/api/recipes/comments` — confirmed against Mealie's actual router (`APIRouter(prefix="/comments", ...)`, mounted top-level, NOT nested under `/api/recipes`) — the old path here doesn't exist on any Mealie version and 404s/405s every time. This was shipped broken and never exercised against a live server until a user reported it (fixed 2026-07-18). |
| DELETE | `/api/comments/{commentId}` | Same prefix correction as above |

### SSO / OIDC login
Added 2026-07-18 after user feedback ("no SSO support?") plus a related finding: `allowPasswordLogin`
can be `false` for a server configured SSO-only, which before this fix meant the app simply couldn't
log in at all, with zero explanation.

Confirmed against Mealie's own OIDC implementation (`mealie/routes/auth/auth.py`) and its published
docs (docs.mealie.io/documentation/getting-started/authentication/oidc) that the flow is designed
**only** for Mealie's first-party web app: the OIDC provider's `redirect_uri` is hardcoded to
Mealie's own `{serverUrl}/login` (custom app schemes aren't supported), where Mealie's own SPA
(`login.vue`) detects the `?code=&state=` callback client-side and completes the exchange itself via
`GET /api/auth/oauth/callback`, storing the result in a plain (**non-httpOnly**) `mealie.access_token`
cookie — confirmed via the frontend's own `nuxt.config.ts` (`AUTH_TOKEN` constant) and
`use-token-cookie.ts` (Nuxt's client-side `useCookie`, which by construction can never set httpOnly,
since only a `Set-Cookie` response header can do that).

Rather than reimplementing that exchange ourselves, `OidcLoginModal.tsx` opens
`{serverUrl}/api/auth/oauth` in an embedded WebView (`react-native-webview`, added 2026-07-18) and
lets Mealie's own SPA complete the entire flow untouched — including the provider redirect and the
code exchange — then reads the resulting cookie via `injectedJavaScript` (a self-clearing
`setInterval` poll for `document.cookie`'s `mealie.access_token`, since the cookie only appears after
an async XHR the SPA fires post-load, not at page-load time). A `?direct=1` redirect back to
Mealie's own login page is Mealie's own failure signal (see `login.vue`'s `oauthAuthenticate` catch
block) and is treated as a cancel. `ConnectScreen` proxies proxy-headers (see above) onto the
WebView's *initial* request only — `react-native-webview`'s `headers` prop doesn't apply to
subsequent in-WebView navigations, a known library limitation, so a proxy header requirement that
covers the OIDC provider's own domain (not just Mealie's) won't be honored past the first hop.

**First live report (2026-07-18, Authentik provider)**: user saw the OIDC login complete inside the
WebView (landed on Mealie's own logged-in interface) but the app never picked it up to finish
signing in. Root cause not confirmed — couldn't reproduce without a live OIDC-enabled server, so
`OidcLoginModal.tsx` was hardened against three plausible causes at once rather than guessing at
one: (1) some Nuxt `useCookie` configs JSON-serialize a string value, wrapping it in literal quote
characters, which would have produced a malformed `Bearer` token — both the poll and a new manual
check now strip a single layer of wrapping quotes if present; (2) added a redundant check on every
`onLoadEnd` in case the self-installing polling interval never got set up on a given page load
(e.g. a full-page reload racing the injection); (3) added a manual **"I've signed in — Continue"**
button, always visible/tappable independent of the loading overlay (which previously covered the
whole modal), so a user is never stuck if the automatic detection misses the cookie — it also
reports back "not signed in yet" distinctly from silence, giving a cleaner signal for next time.
Also gave the `WebView` an explicit `flex: 1` style, which it never had.

**Still not confirmed working end-to-end** — if reported broken again, check whether the manual
button also fails (points at something more fundamental, e.g. cookie name/format actually differs
on that Mealie version) vs. only the automatic poll failing (a timing/injection issue, already
partially mitigated above). This whole section is the first place to check either way.

### Localization (i18n) — in progress, not a Mealie API
Added 2026-07-18 after user feedback ("we need language support!"). This app's UI has ~15 screens
and 500+ hardcoded English strings — translating everything in one pass wasn't realistic, so this
shipped as an infrastructure-plus-pilot: the underlying i18n setup is done and works, but only
`ConnectScreen` and `SettingsScreen` have had their strings actually extracted. Every other screen
still has raw English `<Text>` literals — **this is the expected state, not a bug**, until each
remaining screen gets migrated the same way.

- `src/i18n/index.ts` — `initI18n()` (call once at startup, before anything using
  `useTranslation()` renders — `App.tsx` gates its first render on this), `setLanguage()`,
  `SUPPORTED_LANGUAGES`, `RTL_LANGUAGES`. Uses `i18next` + `react-i18next`; device locale detected
  via `expo-localization`, manual override persisted in AsyncStorage (`mealie_go.language`) and
  takes priority over the device locale on next launch.
- **`initI18n()` must never reject** — `App.tsx`'s entire first render is gated on this promise
  settling, so a rejection would mean a permanent blank screen for every user, not just a missing
  translation. Every internal step (AsyncStorage read, `Localization.getLocales()`, `i18next.init`)
  is individually try/caught with an English fallback, plus a defensive `.catch()` at the call site
  in `App.tsx` as a second line of defense. Keep this property if you touch this file.
- 10 languages as of this writing: English (baseline/source of truth for keys), Chinese
  (Simplified), Hindi, Spanish, French, Arabic, Bengali, Russian, Portuguese, Urdu — chosen as "top
  10 world languages by total speakers" per Ken's request, not by this app's actual userbase. **All
  9 non-English files are AI-translated, not yet reviewed by a native speaker of each language** —
  treat as a reasonable starting point, not verified-correct copy. If a user reports a translation
  is wrong or awkward, that's expected until someone fluent reviews it.
- **Arabic and Urdu are RTL languages, and only their text content is translated so far** — actual
  right-to-left layout mirroring (`I18nManager.forceRTL()`) is not implemented. RN requires an app
  restart for an RTL flip to visually take effect (it can't be applied to an already-mounted tree),
  which will need its own dedicated implementation + testing pass, not a small add-on.
- To migrate another screen: add its keys to `src/i18n/locales/en.json` under a new top-level
  namespace (e.g. `"recipes": {...}`, matching the `"connect"`/`"settings"` pattern already there),
  add the same keys to all 9 other locale files, then swap the screen's hardcoded strings for
  `t('namespace.key')` via `useTranslation()`. Do this screen-by-screen, not as one giant sweep —
  it's much easier to review and verify a handful of screens at a time than the whole app at once.

### Custom proxy headers — not a Mealie API, a reverse-proxy concern
Added 2026-07-17 after user feedback: some self-hosted setups put Mealie behind a reverse proxy
that gates access on its own header-based auth (Cloudflare Access's `CF-Access-Client-Id`/
`CF-Access-Client-Secret`, Authelia, an Nginx config checking a shared API-key header, etc.) —
without sending that header, every request gets blocked by the proxy before it ever reaches
Mealie's own auth. `ConnectScreen` has a collapsed "Using a proxy header?" link (hidden by default
so it doesn't clutter the common case) that expands to repeatable header name/value rows plus
their own "remember or not" toggle, independent of the account's.

Storage/plumbing lives in `mealieApi.ts`:
- `getProxyHeaders()`/`saveProxyHeaders()` — the **active session's** headers, in
  `expo-secure-store` (values can be secrets), read fresh by `request()`/`requestMultipart()`/
  `login()` on every call and merged into the outgoing headers. Persists across app restarts like
  the auth token does, cleared on logout by `clearCredentials()`.
- `getSavedProxyHeadersForServer()`/`saveProxyHeadersForServer()`/`removeSavedProxyHeadersForServer()`
  — a separate per-server-URL "remembered" copy (also SecureStore), offered back when that server
  is picked from the Connect screen's saved-server dropdown. Independent of the account
  remember-toggle — someone can remember the proxy header without remembering their password, or
  vice versa.
- `login()` sends these headers on the `/api/auth/token` call too, since the proxy sits in front of
  that endpoint as well, not just authenticated requests.

### Unit system toggle & PDF export — no server API, done client-side
Mealie's own server-side unit-conversion feature (`GET /api/recipes/{slug}/conversions`) was an
**unmerged, unreleased PR** as of 2026-07 (targets `mealie-next`, not in any stable release) — do
not build against it, it'll break for most self-hosted servers. Instead `src/lib/unitConversion.ts`
does a simple client-side original⇄metric conversion (volume/mass unit tables + °F→°C regex on
instruction text), toggled from Settings or the ingredients tab, stored in AsyncStorage.
Similarly, Mealie has no server-side PDF export (the web UI just uses browser print) — recipe PDF
export is generated on-device with `expo-print` + shared via `expo-sharing`.

---

## Security

Full audit done 2026-07-09 (see Build Status part 8). Summary of what to keep in mind going forward:

- **Saved account passwords** (`SavedAccount[]` in `mealieApi.ts`, the login screen's multi-account
  quick-switch) live in `expo-secure-store`, not AsyncStorage — this was a real plaintext-password
  bug, fixed. If you ever add a new field to `SavedAccount` or a similar "remember this for
  autofill" feature anywhere else, it needs to go through SecureStore too, not AsyncStorage.
  AsyncStorage is fine for non-secret prefs (server URL, unit system, welcome-seen flag) — it's
  specifically credentials/tokens that need the encrypted store.
- **`android.blockedPermissions`** in `app.json` strips `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW`,
  which Expo's default prebuild template includes but this app never uses. `READ_EXTERNAL_STORAGE`/
  `WRITE_EXTERNAL_STORAGE` are still present and legitimately needed by `expo-image-picker`
  (camera roll picking) — don't block those without confirming photo picking still works on
  older (pre-scoped-storage) Android versions first.
- **`usesCleartextTraffic: true`** (via `expo-build-properties`) is intentionally broad, not
  scoped to a specific host — this app needs to support arbitrary self-hosted servers, many of
  which run on plain `http://` over a home LAN. This is a known, accepted, and README-documented
  tradeoff, not an oversight — don't "fix" it by adding a Network Security Config without
  discussing with the user first, since it could break connectivity to legitimate HTTP-only
  servers.
- If you add any new HTML-building code (like the PDF export's `buildRecipePdfHtml`), run
  user/server-controlled text through `escapeHtml()` before interpolating — the existing PDF
  builder does this correctly for every field; match that pattern.

---

## Build Commands

```powershell
# Confirm phone is connected
adb devices

# Install dependencies (first time)
cd path/to/mealie-go
npm install
npx expo prebuild   ← only needed first time or when adding native packages

# Build release APK
cd path/to/mealie-go/android
.\gradlew assembleRelease
adb -s YOUR_DEVICE_SERIAL install -r app\build\outputs\apk\release\app-release.apk
```

**DO NOT use `npx expo run:android`** — registers phantom emulator-5562.
**DO NOT run `npx expo prebuild`** unless a new native package was just added.
When adding a native package, use `npx expo install <pkg>` (picks the SDK-53-compatible version)
then `npx expo prebuild --platform android` — this regenerates `android/` from `app.json` +
`assets/`, including the app icon, so it's safe to re-run after fixing icon assets too.

**Gotcha (bit us 2026-07-09): run `npx expo install --check` after ANY `npm install`.**
A package already in `package.json` (expo-image-picker) had drifted to a version incompatible
with the installed Expo SDK — its native module used an old config schema the current autolinking
no longer reads, so it silently failed to link and crashed on first JS access with
`Cannot find native module 'Exponent...'`. `npx expo install --fix` resolves this; always verify
with `--check` before assuming a crash after adding/updating packages is something else.

**Gotcha: `android.usesCleartextTraffic` in app.json stopped being auto-applied** (needed for
`http://` self-hosted servers — Android 9+/API 28+ blocks cleartext by default). Newer Expo
tooling dropped support for that bare top-level key; it's now set via the `expo-build-properties`
plugin instead (see `app.json`'s plugins array: `["expo-build-properties", {"android": {"usesCleartextTraffic": true}}]`).
If login ever starts failing with a generic network error again, check
`android/app/src/main/AndroidManifest.xml` for `android:usesCleartextTraffic="true"` on the
`<application>` tag after a prebuild — if it's missing, this is why.

Other commands:
```powershell
npx expo start        # dev server
npx tsc --noEmit      # type check
```

---

## Play Store Release Signing

`.\gradlew bundleRelease` (run from `android/`) produces the `.aab` for Play Console upload, at
`android/app/build/outputs/bundle/release/app-release.aab`.

**The upload keystore is `mealie-go-upload-key.jks` at the project root** (gitignored, `*.jks` —
never commit it). This is a Play App Signing "upload key" (Google holds the actual distribution
signing key; if this upload key is ever lost, Google has a self-service reset process since this
isn't the final signing authority — still don't lose it carelessly).

The keystore path/alias/passwords live in `plugins/withReleaseSigning.js` are NOT hardcoded —
they're picked up from **`~/.gradle/gradle.properties`** (the Windows *user-level* Gradle config,
completely outside this repo — not `android/gradle.properties`, which gets wiped every time
`expo prebuild --clean` regenerates `android/`):
```
MEALIEGO_UPLOAD_STORE_FILE=C:/Users/Ken_R/mealiego/mealie-go-upload-key.jks
MEALIEGO_UPLOAD_KEY_ALIAS=mealie-go-upload
MEALIEGO_UPLOAD_STORE_PASSWORD=<...>
MEALIEGO_UPLOAD_KEY_PASSWORD=<...>
```
**Use forward slashes in that path**, even on Windows — Java `.properties` file parsing treats
backslash as an escape character, and `\U`, `\K`, `\m` etc. aren't recognized escapes, so the
backslash (and thus the whole path) silently gets mangled. Forward slashes sidestep this and
Windows/Gradle both accept them fine. (This bit us once — the first `bundleRelease` attempt failed
with "keystore file ... not found" because the path had collapsed to garbage.)

`plugins/withReleaseSigning.js` is a config plugin (registered in `app.json`'s `plugins` array) that
patches `android/app/build.gradle` on every prebuild to add a `signingConfigs.release` block reading
those properties, and repoints `buildTypes.release.signingConfig` at it instead of
`signingConfigs.debug` — **the RN/Expo template default is to sign "release" builds with the debug
keystore**, which is not fit for a real release. Without this plugin, every `expo prebuild --clean`
would silently reset release builds back to debug-signed.

To verify a build is actually signed with the upload key (not debug) before uploading anywhere:
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe" -verify -verbose -certs app-release.aab
```
Should show `CN=Vorisek Labs, OU=Mealie Go, O=Vorisek Labs, C=US` and "jar verified" — that's our
keystore's identity, set when it was generated. `android.versionCode` in `app.json` must increment
on every new Play Console upload (currently `1`).

---

## Assets

`assets/icon.png` and `assets/adaptive-icon.png` are the real Mealie Go branded icon (dark rounded
tile, orange phone + fork/knife glyph) — no longer Kindling placeholders. Both were regenerated
2026-07-09 to shrink the glyph to ~62% of the canvas so it isn't clipped by Android's adaptive-icon
mask (was previously full-bleed, which cropped the phone outline top/bottom on the home screen).
If regenerating again: crop to content bbox, scale to a safe fraction (~60-66%), recenter — Android's
adaptive-icon safe zone is the center 66% of the canvas, so anything larger risks clipping.

---

## Infrastructure

| Service | Notes |
|---|---|
| GitHub | github.com/Vorisek-Labs/mealie-go |
| Google Play Console | Package: `com.voriseklabs.mealiego` |
| Apple Developer | Bundle: `com.voriseklabs.mealiego` |

Publisher account credentials for the above are kept locally, not in this repo.

No Supabase, no RevenueCat, no AdMob, no Cloudflare Worker needed for this app.
The app is free, open-source feel — no subscriptions, no ads.

---

## Session Startup Checklist

1. Read this entire CLAUDE.md
2. Run `npx tsc --noEmit` to check current type errors
3. Ask the user what they want to work on today
4. Never refactor working code unless explicitly asked

## Session End Requirement (MANDATORY)

At the end of every session, commit all changes AND update the Current Build Status section below.

---

## Current Build Status

**Session (latest) — 2026-07-18**

### Session 2026-07-18 (part 2) — stale recipe view after edit, dead disableAmount field, v1.3.2
User reported: "adding an ingredient to an existing recipe manually and it's not displaying, but
every time I go to edit, I can see it still in there." Diagnosed as a stale-data bug, not a save
bug — see the new `disableAmount` note in the API Reference's Recipes section above for the second,
separately-discovered issue.
- **Root cause**: `RecipeDetailScreen` only fetched via a plain `useEffect` keyed on `slug` (fires
  once on mount). `RecipeEditScreen` is pushed onto the same native-stack and pops back via
  `navigation.goBack()` on save — so the detail screen kept showing whatever it had BEFORE the edit
  began, indefinitely, since nothing ever told it to refetch. `RecipeEditScreen` itself always
  looked correct because it re-fetches fresh on its own mount every time. **Fix**: replaced the
  plain `useEffect` with `useFocusEffect`, so it refetches every time the screen regains focus, not
  just the first time.
- Checked for the same bug class elsewhere (`grep` for `navigation.navigate('...Edit`) — this is
  the only detail→edit→back flow in the app, so no other screens needed the same fix.
- **Separately found and fixed**: `RecipeIngredient.disableAmount` doesn't exist on Mealie v3+ at
  all (existed in v2.x, removed in the v3 rewrite — confirmed against Mealie's actual schema
  source). Three places in the app treated it as if it reliably reflected server state after a
  reload, which it never has, in any version of this app — `!quantity` is what actually determines
  the behavior today and always has. Fixed those three; left its legitimate same-session use
  between the parse-review modal and the edit screen alone, since that never touches the server.
  Also dropped the field from the unrelated, entirely-unused `RecipeSettings` type (also not real).
- `npx tsc --noEmit` clean. **Not verified on a physical device** — no device was connected; Ken
  accepted shipping without a device pass again, verifying via Play Store update afterward.
- Bumped to `1.3.2`/versionCode `10`, shipped all three surfaces (GitHub repo pushed, GitHub Release
  `v1.3.2` with signed APK, AAB built for Play Console).

### Session 2026-07-18 (part 3) — old-Mealie-version warning, v1.3.3
Closed out the last item from part 1's feedback batch ("old mealie version is not supported? add a
pre version check?"), which had only been researched, not built, earlier in the day.
- Confirmed a real cutoff by diffing Mealie's own route tree across tags rather than guessing:
  `/api/households/*` (meal plans, shopping lists, cookbooks — core features this app depends on)
  was introduced in **v2.0.0**; nothing older can support large parts of this app.
- Added `isOldMealieVersion()` to `mealieApi.ts` (fails closed to "no warning" on anything that
  doesn't parse as a leading `x.y` version, e.g. Mealie's own `"develop"` dev-build string) and a
  non-blocking warning on `ConnectScreen`, using the `version` field from the same `/api/app/about`
  call already fetched for SSO detection — no new request added.
- Explicitly scoped as the achievable version of the ask, not full per-feature gating (confirmed
  with Ken before building) — true per-feature compatibility checking would need the same kind of
  endpoint-by-endpoint research as the `disableAmount`/comments findings above, repeated across
  every API surface the app touches, and would be its own multi-session effort like the i18n work.
- Added the new string to all 10 already-supported languages, keeping ConnectScreen's translation
  coverage complete rather than leaving an English-only string in a partially-translated screen.
- `npx tsc --noEmit` clean. Not verified on a physical device (same as parts 1–2 today). Bumped to
  `1.3.3`/versionCode `11`, shipped all three surfaces.

### Session 2026-07-18 (part 4) — first live SSO report, hardened OidcLoginModal, v1.3.4
A user (Authentik provider) updated to v1.3.0 and reported the exact untested risk flagged since
that release: the OIDC login completes inside the WebView, but the app never finishes signing in.
See the updated SSO / OIDC login section in the API Reference above for full detail. Couldn't
reproduce without a live OIDC-enabled server, so hardened three plausible causes at once rather
than guessing at one: cookie-value quote-stripping, a redundant per-page-load check, and a manual
"I've signed in — Continue" fallback button that's always tappable (fixed a related layout bug
where the loading overlay could have covered anything placed after it). Also gave the `WebView` an
explicit `flex: 1` it never had. **Still not confirmed fixed** — asked the reporting user to try
the manual button specifically, since whether that also fails is the key signal for what to check
next. `npx tsc --noEmit` clean. Bumped to `1.3.4`/versionCode `12`, shipped all three surfaces.

### Session 2026-07-18 (part 1) — batch of user feedback: ingredient notes/sections, comments bug, SSO, v1.2.2 + v1.3.0 + v1.3.1
Five pieces of user feedback arrived at once; triaged each before touching code rather than
building blind. Confirmed the redirect-downgrade fix from the previous session actually worked for
the reporting user first.

**v1.2.2 (three items, shipped as one release):**
- **Ingredient note field always editable** — `IngredientParseReviewModal.tsx`'s per-ingredient
  Note field in the parse-review dialog was a read-only `Text`, shown only when already non-empty.
  Now always shown and editable (`updateCurrentNote`).
- **Fixed the comments bug** — see the new Comments section in the API Reference above. Real root
  cause (wrong path, `/api/recipes/comments` instead of `/api/comments`), confirmed against
  Mealie's actual router source, not a guess.
- **Ingredient section titles** ("Preparation"/"Main"/"Sauce") — confirmed via Mealie's own
  `RecipeIngredient` schema and its web editor (`RecipeIngredientEditor.vue`'s `toggleTitle()`)
  that this is an existing per-ingredient `title` field with a "toggle section" UI, not a separate
  divider type — matched that exact behavior instead of inventing something new.
  `RecipeEditScreen` gets a per-row toggle; `RecipeDetailScreen` and `CookModeModal` render the
  title as a heading above that ingredient.

**v1.3.0 (SSO/OIDC login — the bigger item):**
See the new SSO / OIDC login section in the API Reference above for the full technical trace
(Mealie's OIDC flow is web-only by design; bridged via an embedded WebView reading a non-httpOnly
cookie Mealie's own SPA sets). Also fixes a related dead end: `allowPasswordLogin: false` (SSO-only
servers) previously meant the app couldn't log in at all, silently.
- New dependency: `react-native-webview`. New component: `OidcLoginModal.tsx`.
- `ConnectScreen` fetches `/api/app/about` on server-URL blur and conditionally shows password
  fields / an OIDC button / both — fails open to password fields on any unknown/unreachable case,
  confirmed by re-reading the full diff before shipping (this touches the login screen every user
  goes through, so a regression here would be far worse than in a single feature screen).
- **NOT verified live** — no OIDC-enabled Mealie server was available to test against, and no
  device was connected this session (Ken accepted the risk and verified via Play Store update
  instead, same as the previous session's redirect fix). `npx expo install --check` clean, Gradle
  build succeeded, `react-native-webview` linked without error. If SSO login is reported broken,
  start with the SSO section in the API Reference above.

**v1.3.1 (i18n foundation — pilot, not complete):**
See the new Localization (i18n) section in the API Reference above. Ken asked for "language
support," ambiguous between UI translation and recipe/import-time language handling (there's
already a `translateLanguage` param on image-import for the latter) — he wants both, and for the
UI half, picked "top 10 most common languages" when asked to prioritize.
- Given ~500+ strings across ~15 screens is not a same-session task, shipped as infrastructure +
  a 2-screen proof of concept (ConnectScreen, SettingsScreen) rather than attempting the whole app
  blind. New dependencies: `i18next`, `react-i18next`, `expo-localization`.
- **`App.tsx` now gates its very first render on `initI18n()`** — the highest-stakes change of this
  session, since it affects every app launch for every user, not just new logins or a single
  screen. Hardened so it can never reject/hang (see the Localization section above) after
  realizing the initial version had no `.catch()` at the call site.
- **Remaining ~13 screens still need migrating** — this is the clear next step for continuing this
  feature, screen-by-screen (see the "how to migrate another screen" note in the Localization
  section above), not a giant one-shot sweep.
- **NOT verified live** — no device was connected this session; Ken accepted the risk again and
  verifies via Play Store update. `npx expo install --check` clean, Gradle build succeeded,
  `expo-localization` linked without error.

All three releases this session: `npx tsc --noEmit` clean throughout. Shipped all three surfaces
each time (GitHub repo pushed, GitHub Release with signed APK cut and verified via `apksigner
verify --print-certs`,
AAB built) — Ken uploads the AAB to Play Console himself.

### Session 2026-07-17 (part 3) — self-healing retry for POST-downgraded-to-GET on redirect, v1.2.1
A different user reported "Import from URL" failing with `405: {"detail":"Method Not Allowed"}`
against a working chefkoch.de URL that imported fine for Ken on his own server. Diagnosed by
pulling Mealie's actual GitHub source for both parties' exact server versions (v3.19.2 vs v3.20.1)
rather than guessing:
- Confirmed via `recipe_crud_routes.py` at both tags that `@router.post("/create/url", ...)` is
  registered identically in both — ruled out a server-version/endpoint-path mismatch.
- Confirmed via `scraper_strategies.py`/`scraper.py` that Mealie's own scraper never passes through
  an origin site's status code — any scrape failure (including a geo-block) surfaces as its own
  400, never a raw passthrough status. This ruled out the user's "is it a Germany/geo-blocking
  thing?" theory — a 405 specifically cannot originate from chefkoch.de being blocked.
- The literal error body (`{"detail":"Method Not Allowed"}`) is Starlette/FastAPI's own default
  405 response shape — confirmed the request really did reach Mealie's own backend rather than a
  generic proxy/CDN block page, which would look different.
- Landed on: the request most likely got silently redirected (e.g. a server force-redirecting
  http → https, common with Nginx Proxy Manager/Caddy/Traefik defaults) and downgraded from POST to
  GET along the way — standard behavior for most HTTP clients (incl. Android's OkHttp, which RN's
  `fetch` uses) following a 301/302. A GET on a POST-only route is exactly what produces this exact
  Starlette 405.
- **Fix (self-healing, not a guess-and-hope)**: verified Mealie's API never legitimately returns
  405 during normal use, so treating any 405 as "retry once against the opposite http/https scheme"
  is always safe — a real 405 means the server never processed the request at all, so there's no
  duplicate-write risk. Added `flipUrlScheme()` + `retryOnRedirectDowngrade()` in `mealieApi.ts`,
  wired into `request()`, `requestMultipart()`, and `login()` (the last of these needed a return-
  shape change to `{ token, serverUrl }` since the resolved URL can differ from what the user
  typed — `ConnectScreen` now persists whichever URL actually worked). This protects every API call
  the app makes, not just URL import, and is completely inert for the normal case where a 405 never
  happens.
- `npx tsc --noEmit` clean. Built + verified release APK signature via `apksigner verify
  --print-certs`. **NOT yet device-tested this round** — no device was connected when this shipped;
  Ken is updating via the Play Store himself. Also not verified against a real
  redirect-downgrade-affected server (no such server available to test against) — the fix is
  reasoned from first principles (RFC 7231 method-downgrade-on-redirect + confirmed Mealie source
  behavior), not confirmed live yet. If the original reporting user still hits this after updating,
  that's the next signal to chase.
- Bumped to `1.2.1`/versionCode `6` (v1.2.0 had already been released the same day, so this
  couldn't reuse that version). Shipped all three surfaces: pushed to `Vorisek-Labs/mealie-go`, cut
  GitHub Release `v1.2.1` with the signed APK, built `app-release.aab` — **Ken still needs to
  upload the AAB to Play Console**.

### Session 2026-07-17 (part 2) — custom proxy header support, v1.2.0 release
User feedback from a Play Store reviewer/user asked for "a proxy header for security" — interpreted
as: their Mealie server sits behind a reverse proxy (Cloudflare Access, Authelia, an API-key-gated
Nginx config, etc.) that requires its own custom header before letting requests through to Mealie
at all. See the new "Custom proxy headers" section above for the full technical detail.
- **Added**: collapsed "Using a proxy header?" link on the Connect screen, expanding to repeatable
  header name/value rows (value masked like a password) with their own independent "remember these
  headers" toggle. Headers are sent on every request including sign-in.
- This also closed a gap: the prior session (part below, "Add Create from Image...") had already
  bumped `app.json` to `1.2.0`/versionCode `5` but never actually cut that release — folded this
  feature into that same unreleased version rather than bumping again.
- Built + installed release APK on device (`R5CN20KJXDL`), confirmed clean launch via logcat (no
  FATAL/AndroidRuntime errors), user confirmed the Connect screen UI looks right and expands
  cleanly. `npx tsc --noEmit` clean.
- Shipped all three release surfaces per the standing checklist: pushed to
  `Vorisek-Labs/mealie-go`, cut GitHub Release `v1.2.0` with the signed APK attached (verified via
  `apksigner verify --print-certs`, not `jarsigner`), and built `app-release.aab` — **still needs
  Ken to actually upload the AAB to Play Console**, that part is outside this repo.
- **NEEDS DEVICE TESTING**: the actual round-trip against a real reverse-proxy-gated server —
  nothing available in this session to test against. UI and normal (non-proxied) login flow are
  confirmed working; whether the headers actually get a real proxy to let a request through has
  not been verified end-to-end.

### Session 2026-07-17 — Play Store approved, links updated
- **App approved and live on Google Play**: https://play.google.com/store/apps/details?id=com.voriseklabs.mealiego
- Added a "Get it on Google Play" link to this repo's README, near the existing website link.
- Updated `mealiego.voriseklabs.com` (nav, hero, footer) and the `voriseklabs.com` Apps section
  (badge changed from "Closed Beta" to "On Google Play", CTA changed from a beta-request mailto
  link to "Visit Mealie Go" + "Get it on Google Play") to reflect the live listing — both of those
  sites live in `Vorisek-Labs/mealie-go-private` (website) and the separate main-site repo, not
  here.

### Session 2026-07-10

### Session 2026-07-10 (part 2) — open source release, Play Store prep, prep/cook time + Cook Mode, v1.1.0
Large session covering going public, Play Store asset prep, and a new feature batch.

**Going public / security**
- Made the repo public under the MIT License, scrubbed AI-authorship trailers and personal info
  (device serial, absolute paths, personal emails) from CLAUDE.md before doing so.
- Full security audit: moved `SavedAccount[]` (saved login credentials) from plaintext AsyncStorage
  to `expo-secure-store` with a one-time migration; removed unused `RECORD_AUDIO`/
  `SYSTEM_ALERT_WINDOW` permissions via `android.blockedPermissions`; documented the
  `usesCleartextTraffic` tradeoff in the README instead of "fixing" it (breaks self-hosted `http://`
  servers otherwise).
- Added a **"Remember this account" toggle** on ConnectScreen — off by default it now skips saving
  credentials entirely and actively purges any pre-existing saved entry for that server+username
  (`removeAccount()` in `mealieApi.ts`), so security-conscious users aren't forced into the
  quick-switch credential store.

**Play Store prep**
- Set up durable release signing (see Play Store Release Signing section above) and produced the
  first signed AAB.
- Built Play Store listing assets (icon, feature graphic, screenshots, listing copy) and a
  marketing/privacy/terms website, **deployed to Cloudflare Pages at `mealiego.voriseklabs.com`**
  (not `mealie.voriseklabs.com` — that subdomain was already in use by Ken's actual live Mealie
  server; caught this before it caused a DNS conflict).
- **`store/` and `website/` were moved out of this public repo** into a new private repo,
  `Vorisek-Labs/mealie-go-private` — they're Play Store/marketing assets, not app source, and don't
  belong in a public OSS repo. History was scrubbed with `git filter-repo` (force-pushed) so neither
  directory is recoverable from old commits in the public repo either. `.gitignore` now excludes
  both paths so they don't get re-added by accident. To edit the website going forward, clone
  `mealie-go-private` separately — it's not part of this working directory's git history anymore.
- Cut GitHub Releases `v1.0.0` and `v1.1.0` (signed release APK attached to each) as an
  alternate/no-Play-Store-required download path for self-hosters.
- Worked through the Play Console "App content" declarations with the user — notably: sign-in IS
  required (the app does nothing without a connected Mealie server), which per Play's binary
  App-access model means a **dedicated demo Mealie server + demo account still needs to be created**
  for reviewer credentials (not the user's personal server) — this is unresolved, tracked as a
  TODO. Data Safety "collects/shares required data types" was answered **No**, matching verified
  live-Play-Store precedent from Nextcloud/Home Assistant (both self-hosted, zero-developer-backend
  apps) despite Google's abstract "collect" wording being ambiguous about user-configured
  third-party endpoints. Health features declared **none** — meal planning and nutrition display
  are both passive/organizational, not the active tracking/goal-management Google's own category
  definitions require.

**New features**
- Prep/Cook/Total time stats moved to right under the recipe title (previously below the
  description).
- **Cook time display bug fixed**: Mealie's own edit UI writes "Cook Time" to `performTime`, not
  `cookTime` (confirmed against Mealie's actual schema/frontend source) — `cookTime` is a legacy
  field only populated by URL-import scrapers. The app now reads `performTime` first, falls back to
  `cookTime` for imported recipes. `RecipeEditScreen`'s "Cook Time" field now writes to
  `performTime` too, so edits made in this app show up correctly in Mealie's own web UI.
- Raw ISO 8601 duration text (e.g. `"PT30M"`, left over from an inconsistent upstream import) is
  now reformatted to readable text (`"30 min"`) wherever time is displayed, instead of showing the
  raw string.
- **Separate Prep Time / Cook Time filters** (`src/lib/timeEstimate.ts`), each with independent
  15/30/60/120-"min or less" buckets (inclusive — labels say "or less", not "under", to be
  accurate), between Categories and Tags in the filter modal on both Recipes and Cookbook screens.
  Mealie has no server-side time filter (prep/cook time are freeform text, not numeric), so this
  pulls the full matching set and filters client-side, same trick already used for "favorites
  only".
- Fixed a layout bug where Prep/Cook/Total/Serves labels misaligned when one value wrapped to two
  lines (e.g. "4 hours 5 minutes") — each stat's value now sits in a fixed two-line-tall centered
  box so labels stay aligned regardless of value length.
- **Cook Mode** (`src/components/CookModeModal.tsx`): full-screen step-by-step view, reachable via
  a "👨‍🍳 Start Cooking" button at the top of a recipe's Steps tab. Prev/Next arrow navigation
  (not Mealie's own side-by-side scroll layout — confirmed via research that Mealie's web Cook Mode
  has no step-by-step arrows, this is a deliberate mobile-specific adaptation), a toggleable
  ingredients panel (Mealie's web Cook Mode does show ingredients alongside steps, so this part
  matches upstream), and `expo-keep-awake` keeps the screen on for as long as it's open — no
  toggle, matches the explicit ask for "no screen turning off... while in cook mode".
- Bumped to `1.1.0` / `versionCode: 2` for this batch.
- Built + installed on device (`R5CN20KJXDL`), confirmed clean launches via logcat after every
  change in this session. `npx tsc --noEmit` clean throughout.
- **NEEDS DEVICE TESTING**: none of this batch's UI has had a live hands-on pass from the user
  beyond what was already spot-checked mid-session (cook time display/filters/Cook Mode were
  confirmed working; the layout/label fixes and v1.1.0 rebuild have NOT been re-verified on device
  since the version bump).
- **STANDING INSTRUCTION (added this session)**: any time an app update is made, all three of these
  need updating together — the GitHub repo (`mealie-go`, source), the release APK attached to the
  matching GitHub Release, and the AAB for Google Play Console. Don't let one lag the others.

### Session 2026-07-10 (part 1) — first signed release AAB, for Play Console upload
- Generated the Play Store upload keystore (`mealie-go-upload-key.jks`, project root, gitignored)
  and wired up durable release signing — see the new Play Store Release Signing section above for
  full detail (keystore location, `~/.gradle/gradle.properties` credentials, the
  `withReleaseSigning` config plugin, and the forward-slash-path gotcha that broke the first
  attempt).
- Added `android.versionCode: 1` to `app.json` (required by Play Console, wasn't set before since
  nothing had shipped past local ADB installs yet).
- Built and verified `app-release.aab` — confirmed via `jarsigner -verify` that it's actually
  signed with the upload key (`CN=Vorisek Labs, OU=Mealie Go`), not the debug keystore the RN/Expo
  template defaults to.
- NEEDS: Ken to actually create the Play Console listing and upload this AAB — that part is fully
  outside this repo/codebase.

### Session 2026-07-09 (part 8) — full security audit + fixes, ahead of going public
User asked for a full security audit ahead of/after making the repo public, since self-hosters
(the app's whole audience) are exactly the people who'll pick apart a public repo's security.
- **FIXED (high severity)**: `SavedAccount[]` (login screen's multi-account quick-switch, which
  stores passwords for autofill) was persisted in plaintext via AsyncStorage — unencrypted at
  rest, AND included in Android's default app-data backup (the `expo-secure-store` backup-exclusion
  rules only protect *its own* prefs file, not AsyncStorage). Moved to `expo-secure-store`, with a
  one-time migration in `getSavedAccounts()` that reads any legacy plaintext copy, re-saves it
  encrypted, and deletes the plaintext original. See the new Security section above.
- **FIXED (low severity)**: removed `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` from the Android
  manifest via `android.blockedPermissions` in `app.json` — these were part of Expo's default
  prebuild template, not used by anything in this app. Confirmed via the actual merged manifest
  (`android/app/build/intermediates/merged_manifests/release/.../AndroidManifest.xml`) that both
  are gone from the final build. Deliberately did NOT remove `READ/WRITE_EXTERNAL_STORAGE` — those
  ARE used, by `expo-image-picker`'s camera-roll picker, confirmed by reading its manifest.
- **Documented (medium severity, not fixed — accepted tradeoff)**: `usesCleartextTraffic: true` is
  app-wide, not host-scoped. Necessary for self-hosted `http://` servers on a home LAN; added a
  Security Notes section to the README explaining the risk and recommending HTTPS/VPN for anyone
  exposing their server beyond their LAN.
- Audited and found clean: PDF export's HTML builder escapes all interpolated text fields; no
  `eval`/`WebView`/`dangerouslySetInnerHTML` anywhere; no hardcoded secrets; `npm audit`'s 16
  moderate advisories are all in the Expo/Metro CLI build toolchain, not the shipped app bundle.
- Built + installed on device, confirmed clean launch via logcat, confirmed the two blocked
  permissions are actually absent from the final merged manifest. `npx tsc --noEmit` clean.
- NEEDS DEVICE TESTING: sign out and back in to exercise the SecureStore migration path end-to-end
  (confirm the saved-account dropdown still offers your account and autofills the password
  correctly) — this wasn't something drivable via adb alone, needs an actual hands-on pass.

### Session 2026-07-09 (part 5) — onboarding: Welcome screen + in-app Guide
- **Welcome screen** — shown once, the first time the app has a logged-in user after install
  (`lib/onboarding.ts` AsyncStorage flag, device-level, survives logout/re-login). "View Quick
  Guide" or "Continue to App".
- **Guide screen** — a root-level modal with quick-reference sections (Recipes, Meal Plan,
  Shopping, Cookbooks, Settings). Reachable from Settings ("How to Use Mealie Go"), and from small
  unobtrusive "?" buttons in the MealPlan and Shopping headers that scroll straight to that
  section via a route param.
- Restructured `RootNavigator` to add a root-level `RootStack` (Welcome/MainTabs/Guide) above the
  tab navigator — needed so Guide/Welcome aren't stuck inside any one tab's own nested stack.
  `navigateToGuide()` walks up parent navigators dynamically to reach it from anywhere.
- Built + installed on device (YOUR_DEVICE_SERIAL), confirmed clean launch via logcat. `npx tsc --noEmit` clean.
- NEEDS DEVICE TESTING: fresh-install Welcome flow (hard to test without wiping app data), both "?"
  guide links scroll to the right section, Settings guide link.

### Session 2026-07-09 (part 7) — cookbook filtering, random recipe, favorites/filter-icon polish
User feedback after trying part 6's features:
- **Fixed**: "favorites only" toggle on RecipesScreen was filtering client-side over only the
  currently-*loaded* page of `recipes`, so favorites set via Mealie's own web UI (or just
  alphabetically past what had been paginated in) never showed even though the favorite flag
  itself was fetched correctly. Now fetches the full matching recipe set (`perPage: 1000`,
  respecting current search/filters) whenever favorites-only is active, instead of relying on
  pagination state that was never meant to represent "everything."
- **Changed**: filter button icon `⚙` → `▤` — the gear read as generic app settings (and visually
  collided with the actual Settings tab) rather than "filter."
- **Added**: Clear All button on `RecipeSuggestionsScreen`'s ingredient/tool picker — deselecting
  many chips one at a time was the friction point called out.
- **Extracted** `useRecipeFilterOptions`, `RecipeFilterModal`, `ActiveFilterChips` (see Shared
  recipe list/filter pieces above) so CookbookDetailScreen could get the same filtering as the
  main list without copy-pasting ~200 lines. `useRecipes` now takes an optional cookbook slug.
- **Added to CookbookDetailScreen**: search, tag/category/tool/food filters, 🎲 random-within-
  cookbook — confirmed via Mealie's source that `cookbook` combines with the organizer filters in
  one request, so this wasn't just possible but a single shared implementation. Mealie's own web
  app doesn't offer this inside a cookbook, so this is ahead of upstream here.
- **Added**: 🎲 random-recipe button on the main RecipesScreen too (`api.getRandomRecipe()`
  generalized to accept the same filter/cookbook params as `getRecipes()`, so "random" always
  respects whatever search/filters are currently active).
- Removed `api.getCookbookRecipes()` / `useCookbookRecipes()` — fully superseded by
  `api.getRecipes({ cookbook })` / `useRecipes(cookbookSlug)`.
- Built + installed on device (YOUR_DEVICE_SERIAL), confirmed clean launch via logcat. `npx tsc --noEmit` clean.
- NEEDS DEVICE TESTING: all of the above, especially the favorites fix (needs a Mealie account
  with favorites set via the web UI to actually verify) and cookbook filtering/random.

### Session 2026-07-09 (part 6) — fixed Welcome-before-login bug, wired 2 more real Mealie features
User caught the Welcome screen appearing on an auto-restored session (before any conscious login
action) and asked to confirm/wire two features they remembered from Mealie proper:
- **Fixed**: Welcome now gated on `AuthContext.justSignedIn` (true only inside `signIn()`, never
  during `checkSession()`'s auto-restore) AND the persisted `hasSeenWelcome` flag — see Onboarding
  section above.
- **Confirmed real via Mealie source** (both were completely unwired in our app before this):
  multi-recipe shopping list building (`POST .../lists/{id}/recipe`, bulk array body) and
  ingredient/tool-based recipe suggestions (`GET /api/recipes/suggestions`) — see API Reference.
- **Added**: "🍽 From Recipes" on ShoppingListDetailScreen — search, multi-select recipes, add all
  their ingredients in one request. Also fixed `addRecipeToShoppingList`'s pre-existing bug (sent
  a bare object where the API requires a JSON array — would have 422'd, never actually exercised
  before this) and consolidated `generateFromMealPlan` onto the same corrected bulk call.
- **Added**: new `RecipeSuggestionsScreen` ("🥕 What Can I Make?", reachable from the Recipes tab
  header) — pick foods/tools you have, see suggested recipes with what's missing called out.
- **Added**: "Add Ingredients to Shopping List" button on RecipeDetailScreen's ingredients tab —
  this was already *claimed* in the Guide's Recipes section from part 5 but never actually built;
  fixed the claim by building it rather than walking back the text.
- Updated Guide content in both the Recipes and Shopping sections to describe all of the above.
- Built + installed on device (YOUR_DEVICE_SERIAL), confirmed clean launch via logcat. `npx tsc --noEmit` clean.
- NEEDS DEVICE TESTING: all of the above, plus re-verify the Welcome timing fix (sign out and back
  in — should show Welcome; force-quit and reopen while still signed in — should not).

### Session 2026-07-09 (part 4) — fixed post-feature-push crash + login network error
Two bugs surfaced only after real device use of part 3's changes:
- **App crashed on launch**: `expo-image-picker` (already in package.json pre-session, at 16.0.6)
  had drifted out of sync with Expo SDK 53 — incompatible native module config schema, so
  `ExponentImagePicker` never linked, crashing the instant JS touched it. Two other packages
  (`expo-secure-store`, `expo-system-ui`) were quietly outdated the same way. Fixed via
  `npx expo install --fix` + full `expo prebuild --clean` + rebuild. See the Gotcha callout in
  Build Commands — **run `npx expo install --check` after any `npm install`**.
- **Login failed with a network error** even with correct credentials: the `expo prebuild --clean`
  above pulled in newer Expo tooling that no longer auto-applies the top-level
  `android.usesCleartextTraffic` app.json key (needed since the user's server is `http://`, and
  Android blocks cleartext by default). Fixed by installing `expo-build-properties` and setting
  `usesCleartextTraffic` through its plugin config instead — see Gotcha callout in Build Commands.
- Crash fix confirmed via logcat (clean launch, no native-module errors). The cleartext fix was
  verified by confirming the manifest attribute is present after rebuild — **not yet confirmed
  against the user's real server**; if login still fails, check that attribute first (see Gotcha).

### Session 2026-07-09 (part 3) — feature-parity push: uploads, cookbooks, favorites, share links, units, PDF
Added everything identified as missing vs. the Mealie web app, per user request:
- **Recipe image upload/replace** — camera icon on the hero image (RecipeDetailScreen), Alert
  action sheet → camera or library via `expo-image-picker` → `api.updateRecipeImage()`.
- **Attachment upload** — "+ Add" in the Attachments section, `expo-document-picker` → any file
  type → `api.uploadRecipeAsset()`.
- **Cookbook create/edit/delete** — CookbooksScreen: "+" to create, long-press card for Edit/Delete,
  name + description + public toggle. `useCookbooks` gained `createCookbook`/`updateCookbook`/`deleteCookbook`.
- **Silent JWT refresh** — `AuthContext` calls `/api/auth/refresh` every 6h and on app-foreground
  (AppState listener). Non-fatal if it fails; existing token keeps working until it actually expires.
- **Favorites** — new `FavoritesContext` (loads `/api/users/{id}/favorites` once, shared across
  screens). Heart toggle on `RecipeCard` and `RecipeDetailScreen`; "favorites only" filter button
  in the Recipes header (client-side filter over already-loaded pages).
- **Share links** — Share button on RecipeDetailScreen now opens a modal to create/list/revoke
  `/api/shared/recipes` tokens and share the public `{serverUrl}/g/{groupSlug}/shared/r/{token}` URL.
  Replaced the old (broken — hardcoded `/g/home/r/`) share behavior.
- **Unit system toggle** — client-side only (see API Reference section for why). Toggle in
  Settings and inline on the ingredients tab; converts ingredient quantities + instruction
  temperatures for display only, never writes back to the recipe.
- **Recipe PDF export** — "PDF" button on RecipeDetailScreen, builds an HTML recipe sheet
  (fetches the image as a base64 data URI first, auth headers don't survive into `expo-print`'s
  renderer otherwise), `Print.printToFileAsync` → `Sharing.shareAsync`.
- New native deps: `expo-image-picker` (was already installed, unused — now used), `expo-document-picker`,
  `expo-print`, `expo-sharing`. Ran `npx expo prebuild --platform android` to link them + regenerate
  the icon (still correct — prebuild reads from the already-fixed `assets/adaptive-icon.png`).
- Built + installed on device (YOUR_DEVICE_SERIAL). `npx tsc --noEmit` clean throughout.
- NEEDS DEVICE TESTING: all of the above — none of it has been exercised against a real Mealie
  server yet. Pay particular attention to: image/attachment upload permissions prompts, share link
  format against the user's actual `groupSlug`, PDF export image embedding.

### Session 2026-07-09 (part 2) — app icon safe-zone fix
- FIXED: home screen icon clipped the phone outline top/bottom. Root cause: source icon was a
  full-bleed 1024×1024 design (touching all 4 edges), but Android's adaptive-icon mask only
  guarantees the center ~66% is visible. Regenerated `assets/icon.png` + `assets/adaptive-icon.png`
  and all `android/.../mipmap-*/ic_launcher*` files with the glyph shrunk to ~62%, recentered.

### Session 2026-07-09 (part 1) — media URL fix + tools/foods filters
- FIXED: recipe images not displaying + attachments failing with 422 UUID error.
  Root cause: media endpoints (`/api/media/recipes/{recipeId}/...`) take the recipe
  **UUID**, not the slug. `recipeImageUrl`, `recipeImageSource`, `recipeAssetUrl` now
  take `recipe.id`; RecipeCard and RecipeDetailScreen updated. Images now sent with
  Bearer auth header via `recipeImageSource`.
- ADDED: filter recipes by **tools** and **foods** (alongside existing tags/categories).
  New API calls `api.getTools()` (`/api/organizers/tools`) and `api.getFoods()` (`/api/foods`).
  `getRecipes` now accepts `tools` (slugs) and `foods` (UUIDs) params.
  `useRecipes` refactored to a single `RecipeFilters` object; filter modal has 4 chip
  sections via shared `ChipSection` component. New `RecipeTool` type.
- Built + installed on device (YOUR_DEVICE_SERIAL). `npx tsc --noEmit` clean.
- NEEDS DEVICE TESTING: images on recipe list/detail, attachment open, tools/foods filters.

**Session 1 — 2026-06-29**

### Setup
- [x] npm install
- [x] Assets copied from Kindling
- [x] `npx expo prebuild`
- [x] ADB build
- [x] App launches on device

### What's been written (Session 1)
All source files scaffolded and ready for `npm install + prebuild`:

**Infrastructure**
- [x] package.json (Expo 53, RN 0.79.6, matches Kindling)
- [x] tsconfig.json, babel.config.js, app.json, .gitignore
- [x] App.tsx

**Core**
- [x] src/theme/index.ts — herb green dark palette
- [x] src/types/index.ts — all Mealie types
- [x] src/lib/mealieApi.ts — full API client, login(), recipeImageSource()
- [x] src/context/AuthContext.tsx — user, serverUrl, token, signIn, logout
- [x] src/navigation/RootNavigator.tsx — auth gate + 5 tabs + nested stacks

**Hooks**
- [x] useRecipes.ts — list, search, pagination
- [x] useMealPlan.ts — week-bounded plan entries
- [x] useShoppingLists.ts — lists + detail (toggle, add, delete)
- [x] useCookbooks.ts — cookbooks + cookbook recipes

**Screens (all written)**
- [x] ConnectScreen.tsx — 3-field login (URL + username + password)
- [x] RecipesScreen.tsx — search, paginated list, pull-to-refresh
- [x] RecipeDetailScreen.tsx — hero image, 3-tab (ingredients/instructions/notes), delete
- [x] AddRecipeScreen.tsx — URL import or manual create (modal)
- [x] MealPlanScreen.tsx — week nav, day strip, entries by meal type
- [x] ShoppingListsScreen.tsx — list of lists, create modal, long-press delete
- [x] ShoppingListDetailScreen.tsx — check-off items, add bar, unchecked/checked sections
- [x] CookbooksScreen.tsx — 2-col grid
- [x] CookbookDetailScreen.tsx — recipe list within cookbook
- [x] SettingsScreen.tsx — server info, user info, sign out

**Components**
- [x] RecipeCard.tsx — image with auth headers, name, description, time/category
- [x] EmptyState.tsx

### Next Session — Pick up here:
1. Confirm login now works against the user's real (http://) server — the cleartext-traffic fix
   was verified in the manifest but not yet against a live login attempt.
2. Device-test everything from part 3 (uploads, cookbooks, favorites, share links, units, PDF),
   part 5 (Welcome/Guide), part 6 (Welcome timing fix, shopping-list-from-recipes, What Can I
   Make?, recipe → shopping list button), and part 7 (favorites-only fix, cookbook filtering,
   random recipe button) — none of it has been exercised live yet.
3. Fix any bugs found during real device testing

### Package versions pinned (do not change without testing)
- expo-asset: ~11.1.7 — REQUIRED, omitting it causes `Cannot find native module 'ExpoAsset'` crash on launch
- react-native: 0.79.6
- react-native-screens: ~4.11.1
- react-native-safe-area-context: 5.4.0
- expo-image-picker, expo-document-picker, expo-print, expo-sharing — added 2026-07-09 for
  photo/attachment upload + PDF export; installed via `npx expo install` (SDK-53-matched versions).
  Run `npx expo install --check` after any `npm install` — see Gotcha in Build Commands, one of
  these silently drifted out of SDK compatibility mid-session and crashed the app.
- expo-build-properties — added 2026-07-09, now the only supported way to set
  `android.usesCleartextTraffic` (see Gotcha in Build Commands; the bare app.json key stopped working)
- expo-file-system — added 2026-07-11, **required by `expo-image-picker`'s camera capture on
  Android even though it's not declared as a dependency in `expo-image-picker`'s own
  `package.json`** (only `expo-image-loader` is). Without it, `launchCameraAsync` throws
  `Module expo.modules.interfaces.filesystem.AppDirectories not found` at runtime — permission
  grants fine, the camera app never opens. `npx expo install --check` does NOT catch this (it only
  flags version drift on packages already installed, not missing undeclared dependencies). If
  camera capture ever breaks again with this exact error, confirm `expo-file-system` is still in
  `package.json` and a clean prebuild (`npx expo prebuild --platform android --clean`) has run
  since.
- react-native-webview — added 2026-07-18 for SSO/OIDC login (`OidcLoginModal.tsx`, see SSO / OIDC
  login section above). Installed via `npx expo install`; linked and built cleanly (`npx expo
  install --check` clean, Gradle build succeeded) but **not exercised on a physical device** this
  session — no device was connected when this shipped.
- i18next, react-i18next, expo-localization — added 2026-07-18 for the Localization (i18n) feature
  above. Same as react-native-webview: linked and built cleanly, `npx expo install --check` clean,
  but not exercised on a physical device this session.

### Known issues / TODO
- No offline caching yet (Mealient had Room DB; we could add AsyncStorage caching later)
- Cookbook create/edit only sets name/description/public — no UI for the `queryFilterString`
  query-builder that newer Mealie cookbooks use to auto-populate recipes
- Unit system toggle only recognizes common US customary units (tsp/tbsp/cup/oz/lb/etc.) converted
  to metric — no true UK-imperial distinction, and unrecognized units pass through unchanged
- Star rating still uses the older `recipe.rating` field via full recipe PUT, not the newer
  per-user `/api/users/{id}/ratings/{slug}` endpoint used by favorites — works but is a different
  mechanism than favorites; left alone since it's shipped and not reported broken

---

*Last updated: 2026-07-09*
