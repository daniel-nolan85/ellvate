# LLV Community — Admin

Moderation dashboard for the LLV Community app. A standalone Next.js app,
independent of the Expo app at the repo root — separate `package.json`,
separate deploy (Vercel, root directory `admin`) — but reading and acting on
the **same** Supabase project the mobile app uses.

## What's here so far

- Sign-in via Supabase Auth magic link, gated by a `dashboard_admins`
  allowlist (no self-service sign-up — see
  `../supabase/migrations/0028_dashboard_admins.sql`)
- Admins page: add/remove who can sign in (can't remove yourself, can't
  remove the last remaining admin)
- Events page: toggle an event as featured

Not yet built: content moderation (posts, comments, missions, services) and
the unified report queue across all six report tables. Both read from the
same live Supabase project, so they're straightforward additions once this
first slice is confirmed working end to end.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the **same** Supabase
   project the mobile app (`../`) points at:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — project
     settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, service_role key. Server-only,
     bypasses Row Level Security by design (that's what lets this app act
     across every member's content) — never expose it to the client, never
     commit it.
2. In Supabase Auth settings, enable the Email provider with magic
   link/OTP sign-in.
3. Apply `../supabase/migrations/0028_dashboard_admins.sql` against the
   project (same pipeline as the mobile app's migrations).
4. Bootstrap the first admin — this is deliberately **not** seeded by the
   migration (no real email addresses belong in version control). Run once,
   directly in the Supabase SQL editor:
   ```sql
   insert into dashboard_admins (email) values ('you@example.com');
   ```
   After that, add further admins from the dashboard's own Admins page.
5. `bun install`
6. `bun run dev` — runs on <http://localhost:3000>

## Deploying (Vercel)

Create a new Vercel project pointed at this same GitHub repo, and set its
**Root Directory** to `admin` in the project settings. Add the three env
vars above in the Vercel project's environment variables (all three
environments — Vercel doesn't read `.env.local`). Everything else is
standard Next.js/Vercel defaults.
