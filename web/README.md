# Community Copilot — Web

The public landing site for **Community Copilot** (built by Norez Solutions
for the Lake Las Vegas community). A standalone Next.js app, independent of
the Expo app at the repo root and of the admin dashboard at `../admin` —
separate `package.json`, separate deploy (Vercel, root directory `web`) —
meant to be the app's web presence before launch (a showcase + waitlist) and
after (a home base pointing people to the stores).

Branding note: the app was previously named "LLV Community" and used an
indigo/dark visual identity — both have since changed (app name →
"Community Copilot", palette → the same desert-oasis palette as the mobile
app, see `../tailwind.config.js`). The logo used here (`components/brand/`)
is a temporary placeholder built from the mobile app's cactus-spinner
character, not the real logo — that's being designed separately.

## What's here

- Hero, a feature overview strip, and a dedicated deep-dive section per
  feature (Forum, Events, Missions, Leaderboard, **Services**, AI
  Assistant) — `components/sections/feature-detail.tsx`, driven by
  `lib/content.ts`
- An app preview, an about section, an FAQ, and a contact form
- Scroll-in animations (`components/motion/reveal.tsx`, framer-motion),
  native smooth-scroll for anchor nav links, and an animated accordion
- Two forms, both backed by the **same** Supabase project the mobile app
  and admin dashboard use, both anon-insert-only (this site only ever has
  the public anon key, never the service-role key):
  - Email waitlist → `waitlist_signups` (`../supabase/migrations/0033_waitlist_signups.sql`)
  - Contact form → `landing_contact_messages` (`../supabase/migrations/0034_landing_contact_messages.sql`)
- Optional email forwarding for both, via `lib/email/send-notification.ts`
  — a no-op until `RESEND_API_KEY` / `CONTACT_FROM_EMAIL` /
  `CONTACT_NOTIFY_EMAIL` are set (needs a purchased domain + an inbox,
  neither of which exist yet; submissions are saved to Supabase regardless)
- shadcn-style UI primitives under `components/ui/` (button, card, input,
  label, badge, accordion) — copied in and owned here, not an npm dependency

Not yet built: real app screenshots (the app preview section is a stylized
mockup, not literal screenshots, since the UI is still moving pre-launch), a
way to read the waitlist/contact messages back out (would be a page in
`../admin`), the real logo, the switch from "join the waitlist" to App
Store / Play Store download buttons once the app has shipped, and a link to
the Norez Solutions LLC/LP page (planned as a separate site).

## Setup

1. Copy `.env.example` to `.env.local` and fill in the **same** Supabase
   project the mobile app (`../`) and admin dashboard (`../admin`) point at
   — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   project settings → API. No service-role key is needed here. The
   `RESEND_API_KEY` / `CONTACT_FROM_EMAIL` / `CONTACT_NOTIFY_EMAIL` vars are
   optional — leave them blank until there's a domain and inbox to send
   from/to.
2. Apply `../supabase/migrations/0033_waitlist_signups.sql` and
   `../supabase/migrations/0034_landing_contact_messages.sql` against the
   project (same pipeline as the mobile app's migrations).
3. `bun install`
4. `bun run dev` — runs on <http://localhost:3000> (or via the repo root's
   `.claude/launch.json` "web" config, on port 3001 alongside "admin" on
   3000)

## Deploying (Vercel)

Create a new Vercel project pointed at this same GitHub repo, and set its
**Root Directory** to `web` in the project settings. Add the env vars above
in the Vercel project's environment variables (all three environments —
Vercel doesn't read `.env.local`). Everything else is standard
Next.js/Vercel defaults.
