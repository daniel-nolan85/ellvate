# Supabase + Clerk (third-party auth)

The backend uses the modern Supabase pattern: no service-role or secret key. The
API routes connect to Supabase with the **publishable key** and forward the
caller's **Clerk session token**, so Postgres **Row-Level Security** enforces
per-user access. Public content is readable anonymously; every write is scoped to
`auth.jwt()->>'sub'` (the Clerk user id).

## Project

- Supabase project: `llv-community-app` (`xwtkfednponwvqafkeqj`), region us-west-1
- URL: `https://xwtkfednponwvqafkeqj.supabase.co`
- Server env (`.env.local`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- Clerk env: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Clerk Frontend API domain: `picked-shiner-93.clerk.accounts.dev`

## Two one-time dashboard steps (required)

The MCP/Management API cannot register third-party auth, so these are manual:

1. **Clerk → Connect with Supabase.** Open
   <https://dashboard.clerk.com/setup/supabase> and follow it. This configures
   Clerk session tokens to include the `role: authenticated` claim that Supabase
   requires.
2. **Supabase → Third-Party Auth.** In the dashboard, Authentication →
   Third-Party Auth → **Add provider → Clerk**, and enter the domain
   `picked-shiner-93.clerk.accounts.dev`.

For CLI/local development the equivalent is in `supabase/config.toml`:

```toml
[auth.third_party.clerk]
enabled = true
domain = "picked-shiner-93.clerk.accounts.dev"
```

Until both are done, Supabase will not accept forwarded Clerk tokens, so
authenticated writes are denied (public reads still work).

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
   (`xwtkfednponwvqafkeqj`) using `supabase/config.toml`.

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
