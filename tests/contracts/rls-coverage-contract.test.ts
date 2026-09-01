import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const migrationsDir = resolve(root, 'supabase/migrations');

const CREATE_TABLE_PATTERN =
  /create table(?: if not exists)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;
const ENABLE_RLS_PATTERN =
  /alter table\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s+enable row level security/gi;

// Regression guard for a real, live security gap Supabase's own advisor
// flagged: two tables (event_reports/mission_reports, weekly_digest_runs)
// were created without ever running `enable row level security` on them --
// Postgres silently ignores every RLS policy on a table until RLS is
// actually enabled for it, so any policy written for such a table is
// completely inert. This scans every migration statically and fails if a
// created table's name never appears in an `enable row level security`
// statement anywhere in migration history, catching the mistake before it
// ever reaches production again.
describe('Supabase RLS coverage contract', () => {
  test('every table created in a migration has row level security enabled', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);

    const created = new Set<string>();
    const rlsEnabled = new Set<string>();

    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
      for (const match of sql.matchAll(CREATE_TABLE_PATTERN)) {
        created.add(match[1].toLowerCase());
      }
      for (const match of sql.matchAll(ENABLE_RLS_PATTERN)) {
        rlsEnabled.add(match[1].toLowerCase());
      }
    }

    const missing = [...created].filter((table) => !rlsEnabled.has(table)).sort();
    expect(missing).toEqual([]);
  });
});
