import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const migrationsDir = resolve(root, 'supabase/migrations');

// Regression guard for a real, live bug: petitions-supabase.ts reads
// petition_signatures directly (as the calling user's own role, to compute
// the viewer's own `signed` flag) whenever the petitions list/detail page is
// non-empty. 0035_petitions.sql enabled RLS and wrote a correct SELECT
// policy on that table, but never granted SELECT on it to `authenticated` --
// Postgres rejects the query with "permission denied" before RLS is ever
// evaluated, so the correct policy was completely inert and every petitions
// list/detail read failed once any petition existed. Fixed by
// 0049_petition_signatures_select_grant.sql. This scans migration history
// so the grant can't be silently dropped/reverted again.
describe('petition_signatures grant contract', () => {
  test('petition_signatures has SELECT granted to authenticated somewhere in migration history', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
    const combined = files
      .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
      .join('\n');

    const hasGrant =
      /grant\s+select[a-z,\s]*\son\s+(?:public\.)?"?petition_signatures"?[a-z,\s]*\sto\s+[a-z,\s]*authenticated/i.test(
        combined,
      );

    expect(hasGrant).toBe(true);
  });
});
