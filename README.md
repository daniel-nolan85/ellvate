# Lake Las Vegas Community App

A mobile community app for Lake Las Vegas, built with Expo SDK 54. It brings the
neighbourhood into one place: a **Forum**, an **Events** calendar, gamified
**Missions** with XP and streaks, a **Leaderboard**, and an **AI Assistant** that
answers questions grounded in real app content — plus a guided first-run
onboarding flow.

The app ships its own backend as Expo API routes over a seeded in-memory store,
so it runs fully functional out of the box with no external services to
configure.

## Stack

- Expo SDK 54, Expo Router 6, React Native 0.81, React 19
- gluestack-ui v3 + NativeWind 4 + Tailwind CSS 3 (design-system tokens, Inter)
- TanStack Query 5 for server state (optimistic mutations, persistence)
- Clerk session boundary (auth defaults to `disabled`)
- Backend: Expo API routes (`app/api/**`) over an in-memory store
- Assistant: Anthropic tool loop when configured, deterministic fallback otherwise

## Prerequisites

- [Bun](https://bun.sh) `1.3.13` (package manager and test runner)
- Node `20.19.x`–`22`
- For device/simulator builds: Xcode (iOS) and/or Android Studio (Android). This
  project uses native/config-plugin dependencies, so use an Expo **development
  build** rather than Expo Go.

## Setup

```bash
cp .env.example .env.local
bun install
```

The default environment is intentionally bootable — no credentials required:

```dotenv
EXPO_PUBLIC_API_URL=          # empty: the app targets its own API routes
EXPO_PUBLIC_AUTH_MODE=disabled
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

When `EXPO_PUBLIC_API_URL` is empty, the app talks to its in-repo API routes
automatically: the running dev server on native, and the same origin on web. Set
it only to point at a different backend.

All `EXPO_PUBLIC_*` values are embedded in the client bundle and must never be
secrets. Server-only secrets (`ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`) are read
by the API routes via `process.env` and must **not** carry the `EXPO_PUBLIC_`
prefix.

## Run

```bash
bun run start      # start the dev server (dev client)
bun run ios        # build and run the iOS development build
bun run android    # build and run the Android development build
bun run web        # run in the browser
```

`bun run start:lan` starts on the LAN with a cleared cache for testing on a
physical device.

First launch drops you into the onboarding flow; completion is persisted, so
subsequent launches open straight into the Forum tab.

## Backend and API

The backend runs inside the Expo dev server. Every route lives under `app/api/**`
and delegates to `src/backend/**`. Base URL in development is derived
automatically; you can exercise it directly:

```bash
curl http://localhost:8081/api/health          # {"ok":true}
curl http://localhost:8081/api/forum/posts
curl -X POST http://localhost:8081/api/missions/mission-1/check-in
```

Endpoints: `forum` (subforums, posts, like), `events` (list, join), `missions`
(list, check-in), `leaderboard`, `me/profile`, and `assistant/chat`. Requests are
attributed to a `demo-user` unless a verified auth token is supplied.

The store is an in-memory singleton seeded from the design data. It persists for
the lifetime of one server process — great for development and single-process
serving, but request-isolated serverless (e.g. EAS Hosting) needs a real
datastore before deploy.

### Enable the live AI assistant (optional)

Without a key, the assistant answers from a deterministic search over real app
content. To use the Anthropic tool loop instead, add to `.env.local`:

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

## Quality gates

```bash
bun run typecheck          # tsc --noEmit
bun run lint               # expo lint
bun run test               # bun test
bun run check:architecture # SAOS structure check
bun run check              # all four of the above
bun run export             # production export (all platforms + API routes)
```

## Project structure

```text
app/                      Expo Router: routes, (tabs) group, api/** route handlers
src/components/ui/        Source-owned gluestack + kit primitives
src/modules/              Feature modules (forum, events, missions, leaderboard,
                          assistant, onboarding, community-shell)
src/platform/             Providers, environment, query client, session, fonts
src/backend/              API-route logic: store, forum, events, missions,
                          leaderboard, profile, assistant, http helpers
```

Modules expose a public `index.ts`; routes and other modules import through it.
Route files stay thin — they orchestrate, modules implement.

## Activate Clerk (optional)

Auth ships `disabled`. To enable the real phone/OTP sign-in wired into onboarding,
set `EXPO_PUBLIC_AUTH_MODE=clerk` and a development `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
then follow [docs/clerk-activation.md](./docs/clerk-activation.md). Until then the
onboarding auth step runs a self-contained demo flow.
