// Deploys the backend (app/api/**) to EAS Hosting's production alias.
//
// `eas deploy` uploads whatever local `dist/` a prior `expo export` produced
// -- it does not build anything itself, and does not read EAS's
// dashboard-configured environment variables. Any non-EXPO_PUBLIC_ secret
// referenced by server code (e.g. CLERK_SECRET_KEY) is resolved from this
// machine's .env.local at export time. Local development intentionally uses
// the Clerk *Development* instance's secret key there, which is a different
// Clerk instance than production -- deploying straight from .env.local ships
// a backend that can never verify a real (production) session token.
//
// This script swaps in the production-only overrides from
// .env.production.local, validates the result, exports, deploys, and always
// restores .env.local afterward -- so local development is never left
// pointed at production credentials, and a bad override value is caught
// before anything ships rather than after.
import { execSync, spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const envLocalPath = resolve(root, '.env.local');
const overridesPath = resolve(root, '.env.production.local');
const backupPath = resolve(root, '.env.local.deploy-backup');

function parseEnvFile(path: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return map;
}

function applyOverrides(baseLines: readonly string[], overrides: Map<string, string>): string[] {
  const remaining = new Map(overrides);
  const merged = baseLines.map((line) => {
    const trimmed = line.trim();
    const eq = trimmed.startsWith('#') ? -1 : trimmed.indexOf('=');
    if (eq === -1) {
      return line;
    }
    const key = trimmed.slice(0, eq).trim();
    const override = remaining.get(key);
    if (override === undefined) {
      return line;
    }
    remaining.delete(key);
    return `${key}=${override}`;
  });
  for (const [key, value] of remaining) {
    merged.push(`${key}=${value}`);
  }
  return merged;
}

function run(command: string, env: NodeJS.ProcessEnv): void {
  console.log(`\n$ ${command}`);
  execSync(command, { env, stdio: 'inherit' });
}

// expo export's underlying Metro/jest-worker process pool has been observed
// to hang indefinitely right after printing its "Exported: <dir>" success
// line -- the real work (writing dist/) is done by then every time this has
// been seen, but the worker processes never shut down on their own,
// stranding a plain execSync waiting forever on an already-finished job.
// Reducing --max-workers did not help (the hang reproduced identically at
// 2 workers), so rather than trust the process to exit naturally, this
// watches stdout for that success line itself and force-kills the whole
// process tree a few seconds after seeing it.
function runExport(command: string, env: NodeJS.ProcessEnv): Promise<void> {
  console.log(`\n$ ${command}`);
  const [cmd, ...args] = command.split(' ');
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { env, stdio: ['inherit', 'pipe', 'inherit'] });
    let exported = false;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolvePromise();
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (!exported && chunk.toString().includes('Exported:')) {
        exported = true;
        // A short grace period in case it does exit on its own -- only
        // force-kill if it's still hanging around after the real work is
        // clearly done.
        setTimeout(() => {
          if (!settled) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    });

    child.on('error', (error) => finish(error));
    child.on('exit', (code) => {
      finish(exported || code === 0 ? undefined : new Error(`${command} exited with code ${code}`));
    });
  });
}

if (!existsSync(envLocalPath)) {
  console.error('.env.local not found -- run `cp .env.example .env.local` first.');
  process.exit(1);
}

if (!existsSync(overridesPath)) {
  console.error(
    [
      '.env.production.local not found.',
      '',
      'Copy .env.production.local.example to .env.production.local and fill',
      'in the real production values (never committed -- .env.* is',
      'gitignored). At minimum this needs the live Clerk secret key from the',
      "Production instance in Clerk's dashboard -- see docs/supabase-clerk.md.",
    ].join('\n'),
  );
  process.exit(1);
}

copyFileSync(envLocalPath, backupPath);
console.log('Backed up .env.local for restoration after this deploy.');

let succeeded = false;
try {
  const devLines = readFileSync(envLocalPath, 'utf8').split('\n');
  const overrides = parseEnvFile(overridesPath);
  writeFileSync(envLocalPath, applyOverrides(devLines, overrides).join('\n'));
  console.log(`Applied production overrides for: ${[...overrides.keys()].join(', ')}`);

  // This script's own process already resolved process.env from .env.local
  // at its own startup, before the rewrite above -- rewriting the file does
  // not retroactively update it here, and execSync would otherwise pass
  // those now-stale values straight through to each child process (real env
  // vars take precedence over a child's own .env file loading). Overriding
  // them explicitly is what actually makes the new values take effect.
  const childEnv = { ...process.env, ...Object.fromEntries(overrides) };

  run('bun run check:production', childEnv);
  await runExport('bunx expo export --platform web', childEnv);
  // Expo bundles every app/api/**/*+api.ts route as its own independent
  // server function, and each one's sourcemap embeds a full copy of the
  // shared backend code it imports -- so total sourcemap size scales with
  // route count, not just app size. EAS Hosting caps the combined gzipped
  // sourcemap size at 15MB across a deployment; with enough routes (69 and
  // climbing as of this comment) that cap gets crossed on its own, with no
  // code-level fix available. --no-source-maps excludes sourcemaps from the
  // upload entirely rather than failing the deploy -- an acceptable trade
  // since EAS Hosting's own function logs are the only consumer, and this
  // project doesn't currently upload these particular sourcemaps to Sentry
  // either.
  run('eas deploy --prod --no-source-maps', childEnv);
  succeeded = true;
} catch (error) {
  console.error('\nDeploy failed:', error instanceof Error ? error.message : error);
} finally {
  copyFileSync(backupPath, envLocalPath);
  unlinkSync(backupPath);
  console.log('Restored your local .env.local.');
}

if (!succeeded) {
  process.exit(1);
}
console.log('\nBackend deployed to production.');
