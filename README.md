# Mealie Go

A mobile app for [Mealie](https://mealie.io), the self-hosted recipe manager and meal planner.
Mealie Go connects directly to your own Mealie server — there's no separate backend, no account
to create, and no third-party service in between. Point it at your server, sign in, and go.

Built with React Native + Expo. Android is the primary target today; iOS support is on the roadmap.

## Features

### Recipes
- Browse, search, and filter your collection by category, tag, tool, or ingredient
- Favorite recipes, and filter the list down to favorites only
- Import a recipe from a URL, or create one by hand with a full editor
- Upload or replace a recipe's photo, and attach files (PDFs, docs, etc.)
- Scale servings, and toggle ingredient units between as-written and metric
- Rate recipes and leave comments
- Generate a public share link — friends can view a recipe without a Mealie account
- Export any recipe to PDF for printing or sending
- **Random recipe** picker, both across your whole collection and inside a single cookbook
- **"What can I make?"** — pick the ingredients and tools you have on hand and get recipe
  suggestions, with anything you're still missing called out

### Meal Planning
- Weekly view with day-by-day breakfast/lunch/dinner/side slots
- Add a recipe or a freeform note to any slot
- "Surprise me" — assign a random recipe from your collection

### Shopping Lists
- Multiple lists, manual items with quantities
- Generate a list from the current week's meal plan automatically
- Or build one by hand-picking several recipes at once — their ingredients get added in one go
- Send a single recipe's ingredients to any list straight from its detail page

### Cookbooks
- Browse, create, edit, and delete cookbooks
- The same search, filtering, and random-recipe tools as the main recipe list, scoped to that
  cookbook — this isn't available in Mealie's own web app today

### Getting Oriented
- A first-launch welcome screen with a quick-reference in-app guide
- Small contextual links to the relevant guide section on the trickier screens (meal planning,
  shopping lists)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo (TypeScript) |
| Navigation | React Navigation v7 |
| Backend | Mealie's REST API directly — no separate server, no Supabase, no proprietary backend |
| Auth | JWT from Mealie's `/api/auth/token`, stored in `expo-secure-store` |
| State | React Context + hooks |

## Building it yourself

```bash
git clone https://github.com/Vorisek-Labs/mealie-go.git
cd mealie-go
npm install
npx expo prebuild --platform android

cd android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

You'll need a running Mealie server to connect to — see the
[Mealie documentation](https://docs.mealie.io) if you don't have one yet.

`CLAUDE.md` in this repo has a much more detailed engineering log: API endpoints actually used
(with gotchas Mealie's own docs don't cover), architectural decisions, and known issues. Worth a
read whether you're using an AI coding assistant or not.

## Security Notes

- **Cleartext (`http://`) traffic is allowed app-wide.** This isn't scoped to a specific host via
  an Android Network Security Config — it's a blanket allowance, needed because plenty of
  self-hosted Mealie instances run over plain HTTP on a home LAN with no reverse proxy in front.
  If your server is reachable at `http://`, your login credentials and JWT cross the network
  unencrypted, same as any other plaintext-HTTP traffic. If your Mealie server is reachable from
  outside your LAN, put it behind HTTPS (a reverse proxy like Caddy or Traefik with a real cert,
  or a Let's Encrypt setup) or access it over a VPN/Tailscale instead of exposing plain HTTP to the
  internet.
- Saved login credentials (used for the multi-account quick-switch on the login screen) are stored
  in `expo-secure-store` (Android Keystore-encrypted, excluded from Android app-data backups), not
  in plain AsyncStorage.
- Found a security issue? Please open an issue (or a private security advisory, if you'd rather
  not disclose it publicly first) — this is a hobby project without a dedicated security contact,
  but reports are welcome and will be taken seriously.

## Open Source

Mealie Go is free and open source under the [MIT License](LICENSE). Fork it, modify it, self-host
your own build, submit a pull request — whatever's useful to you. There's no catch and no
monetization built into this codebase; it's a labor-of-love companion app for a project (Mealie)
that's also free and open source.

If you build something on top of it or find a bug, issues and PRs are welcome.
