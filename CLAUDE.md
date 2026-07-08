# Mealie Go — Claude Code Briefing Document

Read this entire file at the start of every session before writing any code.
This is the single source of truth for the project.

---

## What is Mealie Go?

Mealie Go is a mobile Android app (React Native + Expo) for the self-hosted recipe manager Mealie.
It lets you and your friends/family browse recipes, plan meals, manage shopping lists, and browse cookbooks — all from your phone, connected to any self-hosted Mealie server.

Target platforms: Android (primary), iOS (secondary).
One codebase via React Native + Expo targeting both.

Play Store package: `com.voriseklabs.mealinego`

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
    ├── types/
    │   └── index.ts               ← all TypeScript interfaces (Recipe, MealPlan, Shopping, etc.)
    ├── lib/
    │   └── mealieApi.ts           ← Mealie API client: login(), api.*, recipeImageSource()
    ├── context/
    │   └── AuthContext.tsx        ← user, serverUrl, token, loading, signIn(), logout()
    ├── hooks/
    │   ├── useRecipes.ts          ← list + search + pagination
    │   ├── useMealPlan.ts         ← week-bounded meal plan entries
    │   ├── useShoppingLists.ts    ← lists + useShoppingListDetail (items, toggle, delete)
    │   └── useCookbooks.ts        ← useCookbooks + useCookbookRecipes
    ├── navigation/
    │   └── RootNavigator.tsx      ← auth gate + 5-tab navigator + nested stacks
    ├── components/
    │   ├── RecipeCard.tsx         ← card with auth-gated image, calls useAuth() internally
    │   └── EmptyState.tsx         ← icon + title + subtitle
    └── screens/
        ├── auth/
        │   └── ConnectScreen.tsx  ← server URL + username + password → login
        ├── RecipesScreen.tsx      ← list with search, + button → AddRecipe
        ├── RecipeDetailScreen.tsx ← hero image, tabs: ingredients/instructions/notes
        ├── AddRecipeScreen.tsx    ← modal: import URL or create manually
        ├── MealPlanScreen.tsx     ← week strip + day entries by meal type
        ├── ShoppingListsScreen.tsx       ← list of shopping lists
        ├── ShoppingListDetailScreen.tsx  ← items with check-off + add bar
        ├── CookbooksScreen.tsx    ← 2-col grid of cookbook cards
        ├── CookbookDetailScreen.tsx      ← recipes in a cookbook
        └── SettingsScreen.tsx     ← server info, user info, sign out
```

---

## Design System

### Theme — Herb Green, Dark Mode First

```typescript
// src/theme/index.ts
colors.background      = '#0D110D'   // deep dark with slight green tint
colors.surface         = '#171D17'
colors.surfaceElevated = '#1E261E'

colors.primary         = '#5DAA7A'   // herb/sage green
colors.primaryLight    = '#7BC49A'
colors.primaryDark     = '#3D8A5A'
colors.accent          = '#E07B54'   // warm terracotta

colors.textPrimary     = '#F0F4F0'
colors.textSecondary   = '#8EA48E'
colors.textDisabled    = '#4A5A4A'
colors.textInverse     = '#0D110D'

colors.tabBarActive    = '#5DAA7A'
colors.tabBarInactive  = '#4A5A4A'
```

### Navigation — 5 Bottom Tabs + Nested Stacks

| Tab | Stack screens |
|---|---|
| Recipes 🍽️ | RecipesList → RecipeDetail, AddRecipe (modal) |
| Meal Plan 📅 | Single screen (no nested stack) |
| Shopping 🛒 | ShoppingLists → ShoppingListDetail |
| Cookbooks 📖 | CookbooksList → CookbookDetail |
| Settings ⚙️ | Single screen |

---

## API Reference (Mealie v3.x)

All requests: `Authorization: Bearer <token>`, `Content-Type: application/json`.
Base URL: whatever the user entered on ConnectScreen.

### Recipes
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes` | `?page=1&perPage=50&search=&orderBy=name` |
| GET | `/api/recipes/{slug}` | Full recipe with ingredients + instructions |
| POST | `/api/recipes` | Body: `{ name }` → returns slug string |
| POST | `/api/recipes/create-url` | Body: `{ url }` → returns slug string |
| PUT | `/api/recipes/{slug}` | Full recipe body |
| DELETE | `/api/recipes/{slug}` | |

### Images
`{serverUrl}/api/media/recipes/{slug}/images/original.webp`
Requires `Authorization: Bearer <token>` header. Use `recipeImageSource(serverUrl, token, slug)` from `mealieApi.ts` which returns `{ uri, headers }` for the Image source prop.

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

### Cookbooks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/households/cookbooks` | `?perPage=50` |
| GET | `/api/recipes?cookbook={slug}` | Recipes in a cookbook |

### Auth / User
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/token` | Form data (NOT JSON): `username, password, remember_me` |
| GET | `/api/users/self` | Returns UserProfile |
| GET | `/api/auth/refresh` | Refresh token if needed (not yet wired up) |

---

## Build Commands

```powershell
# Confirm phone is connected (serial: R5CN20KJXDL)
adb devices

# Install dependencies (first time)
cd C:\Users\Ken_R\MealieGo
npm install
npx expo prebuild   ← only needed first time or when adding native packages

# Build release APK
cd C:\Users\Ken_R\MealieGo\android
.\gradlew assembleRelease
adb -s R5CN20KJXDL install -r app\build\outputs\apk\release\app-release.apk
```

**DO NOT use `npx expo run:android`** — registers phantom emulator-5562.
**DO NOT run `npx expo prebuild`** unless a new native package was just added.

Other commands:
```powershell
npx expo start        # dev server
npx tsc --noEmit      # type check
```

---

## Assets Bootstrap

The `assets/` folder needs PNG files before you can build. Copy from Kindling as placeholders:

```powershell
copy C:\Users\Ken_R\Kindling\assets\icon.png C:\Users\Ken_R\MealieGo\assets\
copy C:\Users\Ken_R\Kindling\assets\adaptive-icon.png C:\Users\Ken_R\MealieGo\assets\
copy C:\Users\Ken_R\Kindling\assets\splash.png C:\Users\Ken_R\MealieGo\assets\
copy C:\Users\Ken_R\Kindling\assets\favicon.png C:\Users\Ken_R\MealieGo\assets\
```

Replace with real Mealie Go branded assets before Play Store submission.

---

## Shared Infrastructure Accounts

| Service | Account | Notes |
|---|---|---|
| GitHub | github.com/Vorisek-Labs | Create repo: Vorisek-Labs/mealie-go |
| Google Play Console | voriseklabs@gmail.com | Package: com.voriseklabs.mealinego |
| Apple Developer | voriseklabs@gmail.com | Bundle: com.voriseklabs.mealinego |

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

**Session 1 — 2026-06-29**

### Setup
- [ ] npm install (not yet run)
- [ ] Assets copied from Kindling
- [ ] `npx expo prebuild` (not yet run — needed before first ADB build)
- [ ] First ADB build
- [ ] App launches on device

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
1. Copy assets from Kindling (see Assets Bootstrap above)
2. `cd C:\Users\Ken_R\MealieGo && npm install`
3. `npx expo prebuild` → generates android/ folder
4. Build APK and install on device
5. Run `npx tsc --noEmit` and fix any type errors
6. Test ConnectScreen with real Mealie server (once server is set up)
7. Fix any bugs found during real device testing

### Package versions pinned (do not change without testing)
- expo-asset: ~11.1.7 — REQUIRED, omitting it causes `Cannot find native module 'ExpoAsset'` crash on launch
- usesCleartextTraffic: true in app.json android section — REQUIRED for http:// local server connections (Android 9+ blocks cleartext HTTP by default)
- react-native: 0.79.6
- react-native-screens: ~4.11.1
- react-native-safe-area-context: 5.4.0

### Known issues / TODO
- Token refresh not implemented — if JWT expires, user must sign out and reconnect
- Meal plan "Add entry" button not yet implemented (read-only view for now)
- Recipe editing (full edit form) not yet implemented — import/create only
- No offline caching yet (Mealient had Room DB; we could add AsyncStorage caching later)
- Mealie server needs to be set up by Ken before the app can be fully tested

---

*Last updated: 2026-06-29*
