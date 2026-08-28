# Supabase + Clerk (third-party auth)

The backend uses the modern Supabase pattern: no service-role or secret key. The
API routes connect to Supabase with the **publishable key** and forward the
caller's **Clerk session token**, so Postgres **Row-Level Security** enforces
per-user access. Public content is readable anonymously; every write is scoped to
`auth.jwt()->>'sub'` (the Clerk user id).

## Project

- Supabase project: `llv-community-app` (`egrplppfgvejouhmcmtx`), region us-west-1
- URL: `https://egrplppfgvejouhmcmtx.supabase.co`
- Server env (`.env.local`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- Clerk env: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Clerk application: `community-copilot` (dashboard display name only —
  rename it to `ellvate` in Clerk's dashboard if you want the label to
  match; nothing functional depends on it), Development instance
- Clerk Frontend API domain: `capable-condor-8303.clerk.accounts.dev`

## Two one-time dashboard steps (required)

The MCP/Management API cannot register third-party auth, so these are manual:

1. **Clerk → Connect with Supabase.** Open
   <https://dashboard.clerk.com/setup/supabase> and follow it. This configures
   Clerk session tokens to include the `role: authenticated` claim that Supabase
   requires.
2. **Supabase → Third-Party Auth.** In the dashboard, Authentication →
   Sign In / Providers → **Third-Party Auth** tab → **Add provider → Clerk**,
   and enter the domain `capable-condor-8303.clerk.accounts.dev`.

For CLI/local development the equivalent is in `supabase/config.toml`:

```toml
[auth.third_party.clerk]
enabled = true
domain = "capable-condor-8303.clerk.accounts.dev"
```

Note: the above is the Clerk **Development** instance (`pk_test_`/`sk_test_`
keys), used for local development and the preview/dev EAS environments. A
**Production** instance (`pk_live_`/`sk_live_` keys, Frontend API domain
`clerk.ellvate.com`) is also connected the same way and is what shipped App
Store builds use -- if a Supabase-write feature is ever added, register it
against both instances' Frontend API domains, not just this Development one.

Until both are done for a given instance, Supabase will not accept forwarded
Clerk tokens from it, so authenticated writes are denied (public reads still
work).

## Deploying the backend to production

`.env.local` intentionally holds the **Development** instance's
`CLERK_SECRET_KEY` for everyday local development. `eas deploy` uploads
whatever local `dist/` a prior `expo export` produced -- it does not read
EAS's dashboard-configured environment variables, so exporting straight from
`.env.local` ships a backend that verifies tokens against the wrong Clerk
instance and rejects every real session token from the production app.

Use `bun run deploy:backend` instead of running `expo export`/`eas deploy`
directly -- it swaps in the production-only overrides from
`.env.production.local` (copy `.env.production.local.example` to create it
once), runs `bun run check:production` to catch a wrong/missing value before
anything ships, exports, deploys, and always restores `.env.local` to your
normal local-development config afterward, even if a step fails.

## Security model (verified)

- RLS enabled on every table; public read on content, per-user write.
- Cross-user writes run through SECURITY DEFINER triggers: `bump_like_count`,
  `bump_reply_count`, and `notify_post_author` (creates a notification for the
  post owner when someone else comments).
- Verified with simulated JWT claims: a user liking/commenting bumps the owner's
  counts and notifies them; a user cannot act as another user; anonymous cannot
  write. See `supabase/migrations/0003_rls_policies_and_triggers.sql`.

## Migrations

`supabase/migrations/*.sql` are the source of truth for the project's schema,
numbered sequentially (`0001`, `0002`, ...). The earliest few (`0001` schema,
`0002` seed, `0003` RLS + triggers) were originally applied ad hoc via the
Supabase MCP; every migration since is deployed with the Supabase CLI.

**One-time setup:**

1. Install the Supabase CLI. It isn't published on npm for Windows, so install
   it per platform:
   - Windows: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git`
     then `scoop install supabase` (see https://scoop.sh if Scoop itself isn't
     installed yet).
   - macOS: `brew install supabase/tap/supabase`.
   - Linux/CI: `npm install -g supabase` or the install script from
     https://github.com/supabase/cli#install-the-cli.
2. `supabase login` (opens a browser to authenticate the CLI once).
3. `bun run db:link` — links this checkout to the `llv-community-app` project
   (`egrplppfgvejouhmcmtx`) using `supabase/config.toml`.

**Deploying a migration:**

1. Add a new `supabase/migrations/NNNN_description.sql` file, continuing the
   existing sequential numbering (check the highest existing number first).
2. `bun run db:push` — applies any migrations not yet recorded against the
   linked project's `supabase_migrations.schema_migrations` table, in order.
3. `bun run db:diff` — optional sanity check afterward; diffs the linked
   project's live schema against the local migration history and should come
   back empty.

Never hand-edit an already-pushed migration file — add a new one instead, the
same convention already used throughout `supabase/migrations/`.
