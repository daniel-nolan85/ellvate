# LLV Community — Admin

Moderation dashboard for the LLV Community app. A standalone Next.js app,
independent of the Expo app at the repo root — separate `package.json`,
separate deploy (Vercel, root directory `admin`) — but reading and acting on
the **same** Supabase project the mobile app uses.

## What's here so far

- Sign-in via an emailed one-time code (Supabase Auth `signInWithOtp` +
  `verifyOtp`, not the magic-link half of the same flow — no redirect/Site
  URL configuration involved), gated by a `dashboard_admins` allowlist (no
  self-service sign-up — see `../supabase/migrations/0028_dashboard_admins.sql`)
- Admins page: add/remove who can sign in (can't remove yourself, can't
  remove the last remaining admin)
- Events page: toggle an event as featured
- Posts, Comments (forum/event/mission + service reviews, tabbed), Missions,
  and Services pages: view and delete content
- Reports page: unified queue merging all six report tables (post, comment,
  event comment, mission comment, service review, mission check-in photo),
  each joined to its target content and reporter, with a delete action that
  resolves the report by removing the reported content (every report table
  cascades from its target, so there's no separate "dismiss" action)

Not yet built: a "report a member" feature doesn't exist anywhere in the app
(only content — posts/comments/reviews/check-ins — can be reported), so
there's no reported-users view here either. Would need a new table + RLS
policies + app-side UI before an admin surface for it makes sense.

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
   link/OTP sign-in. Then, in Authentication → Email Templates → Magic Link,
   make sure the template includes `{{ .Token }}` somewhere in the body
   (Supabase's default template only shows the confirmation link) — that's
   the actual code this app has the admin enter, since it never follows the
   link.
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
