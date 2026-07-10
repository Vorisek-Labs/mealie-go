# Mealie Go

A mobile app for [Mealie](https://mealie.io), the self-hosted recipe manager and meal planner.
Mealie Go talks directly to your own Mealie server. No separate backend, no account to create,
nothing in between. Point it at your server, sign in, and you're in.

Built with React Native + Expo. Android is the main target right now, iOS support is on the roadmap.

## Features

### Recipes
- Browse, search, and filter your collection by category, tag, tool, or ingredient
- Favorite recipes and filter the list down to favorites only
- Import a recipe from a URL, or create one by hand with a full editor
- Upload or replace a recipe's photo, and attach files like PDFs
- Scale servings, and toggle ingredient units between as-written and metric
- Rate recipes and leave comments
- Generate a public share link so friends can view a recipe without a Mealie account
- Export any recipe to PDF for printing or sending
- Random recipe picker, across your whole collection or inside a single cookbook
- "What can I make?" - pick the ingredients and tools you have on hand and get recipe
  suggestions, with anything you're still missing called out

### Meal Planning
- Weekly view with day-by-day breakfast, lunch, dinner, and side slots
- Add a recipe or a freeform note to any slot
- "Surprise me" assigns a random recipe from your collection

### Shopping Lists
- Multiple lists, with manual items and quantities
- Generate a list from the current week's meal plan automatically
- Or build one by hand-picking several recipes at once, their ingredients all get added in one go
- Send a single recipe's ingredients to any list right from its detail page

### Cookbooks
- Browse, create, edit, and delete cookbooks
- Same search, filtering, and random-recipe tools as the main recipe list, scoped to a single
  cookbook. Mealie's own web app doesn't offer that yet.

### Getting Oriented
- A first-launch welcome screen with a quick-reference in-app guide
- Small contextual links to the relevant guide section on the trickier screens (meal planning,
  shopping lists)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo (TypeScript) |
| Navigation | React Navigation v7 |
| Backend | Mealie's REST API directly, no separate server, no Supabase, no proprietary backend |
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

You'll need a running Mealie server to connect to. Check out the
[Mealie documentation](https://docs.mealie.io) if you don't have one yet.

`CLAUDE.md` in this repo is a detailed engineering log covering the API endpoints actually used
(including a few gotchas Mealie's own docs don't mention), architectural decisions, and known
issues. Worth a skim if you're digging into the code.

## Security Notes

- **Cleartext (`http://`) traffic is allowed app-wide.** This isn't scoped to a specific host with
  an Android Network Security Config, it's a blanket allowance, because plenty of self-hosted
  Mealie instances run over plain HTTP on a home LAN with no reverse proxy in front. If your server
  is reachable at `http://`, your login credentials and JWT cross the network unencrypted, same as
  any other plaintext HTTP traffic. If your Mealie server is reachable from outside your LAN, put
  it behind HTTPS (a reverse proxy like Caddy or Traefik with a real cert, or Let's Encrypt) or
  access it over a VPN/Tailscale instead of exposing plain HTTP to the internet.
- Saved login credentials (used for the multi-account quick-switch on the login screen) are stored
  in `expo-secure-store` (Android Keystore-encrypted, excluded from Android app-data backups), not
  plain AsyncStorage.
- Found a security issue? Open an issue, or a private security advisory if you'd rather not
  disclose it publicly first. This is a hobby project without a dedicated security contact, but
  reports are welcome and will be taken seriously.

## Open Source

Mealie Go is free and open source under the [MIT License](LICENSE). Fork it, modify it, self-host
your own build, send a pull request, whatever's useful to you. No catch, no monetization built
into this codebase. Just a labor of love for a project (Mealie) that's also free and open source.

If you build something on top of it or find a bug, issues and PRs are welcome.
