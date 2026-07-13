# EAS OTA updates (Expo SDK 54)

This starter includes EAS Update integration for Expo SDK 54. OTA is a release
tool for JavaScript and asset-only changes; it does not replace native builds.

## Required app configuration

The copied app's config must contain the EAS project ID and update URL created by
`eas init` / `eas update:configure`. The project ID is stable for that Expo
project and must not be reused from another app.

```json
{
  "expo": {
    "version": "1.0.0",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 3000,
      "url": "https://u.expo.dev/<EAS_PROJECT_ID>"
    },
    "extra": {
      "eas": {
        "projectId": "<EAS_PROJECT_ID>"
      }
    }
  }
}
```

With the `appVersion` policy, `expo.version` is the runtime version. Bumping only
the iOS build number or Android version code does not create a new runtime.
Whenever native compatibility changes, bump the app version and create a new
binary before publishing updates for that runtime.

## Update eligibility

An installed binary receives an update only when all three values match exactly:

1. Platform (`ios` or `android`).
2. Runtime version embedded in the binary.
3. The update branch addressed by the binary's embedded channel.

The `preview` build profile embeds the `preview` channel and the `production`
profile embeds the `production` channel. A channel normally points to an update
branch with the same name, but EAS can repoint it. A development client is not
fixed to one channel and can open any update compatible with its native runtime.

## Environment safety on SDK 54

Always pass `--environment` when publishing. On SDK 54, omitting it makes
`eas update` fall back to local dotenv files. That can produce an OTA bundle with
different API URLs, Clerk keys, or feature flags from the receiving EAS build.

The `environment` values in `eas.json` and the publish command must agree:

```bash
# Preview only; this command publishes when intentionally executed.
bunx eas-cli update \
  --channel preview \
  --platform ios \
  --environment preview \
  --clear-cache \
  --message "Describe the user-facing change"

# Production only after preview verification and explicit release approval.
bunx eas-cli update \
  --channel production \
  --platform ios \
  --environment production \
  --clear-cache \
  --message "Describe the user-facing change"
```

Keep `--clear-cache`. Public environment-variable substitutions occur during
bundling, and stale Metro transforms can otherwise preserve an old value when
the importing source file did not change.

`EXPO_PUBLIC_*` values are embedded in the client bundle and are not secrets.
Never place server credentials, private API keys, signing material, or other
secrets in client-readable variables.

## Native build or OTA?

An OTA is appropriate for changes limited to:

- TypeScript/JavaScript behavior, copy, styles, and navigation logic.
- Images, fonts, and other assets bundled into the update.
- JavaScript-only dependencies that do not alter the native runtime.

Create a new EAS build for:

- Expo SDK or React Native upgrades.
- Adding, removing, or upgrading native modules or dependencies that affect
  CocoaPods/Gradle.
- Config-plugin, permission, entitlement, associated-domain, Info.plist, or
  Android manifest changes.
- Bundle identifiers, URL schemes, icons, splash configuration, or build
  properties.
- Any `runtimeVersion` or app-version change.

When uncertain, treat the change as native and build. An incompatible update can
only be repaired reliably by shipping a compatible binary or rolling back the
update.

## App bootstrap and diagnostics

Mount the idempotent hook once in the root layout/provider shell:

```tsx
import { useExpoUpdatesBootstrap } from '@/src/platform/updates';

export function AppBootstrap() {
  useExpoUpdatesBootstrap();
  return null;
}
```

The hook does nothing in development or when `expo-updates` is disabled. In a
release build it logs the channel, runtime version, current update ID, embedded
and emergency-launch state, and recent native update failures. It checks once
per JavaScript runtime, fetches an available update, and reloads only when the
fetch result is a new update. Network and update failures are logged without
crashing startup.

For a diagnostics screen or support bundle, use `getExpoUpdateDiagnostics()` and
`getRecentExpoUpdateFailures()` from the same public module.

## Verification runbook

1. Confirm the intended commit is clean, reviewed, and pushed.
2. Run the repository quality gates and a local export:

   ```bash
   bun run typecheck
   bun run lint
   bun run test
   bun run export
   ```

3. For a new runtime or native change, build and install the matching profile:

   ```bash
   bunx eas-cli build --profile preview --platform ios
   ```

4. Publish to `preview` with `--environment preview --clear-cache`.
5. Inspect the returned update group and channel:

   ```bash
   bunx eas-cli channel:view preview
   bunx eas-cli branch:view preview
   bunx eas-cli update:view <UPDATE_GROUP_ID>
   ```

6. Force close and relaunch the installed preview app. With the normal startup
   policy, downloading can happen on one launch and activation on the next, so a
   second force close/relaunch may be required.
7. Confirm native logs report the expected channel, runtime version, and update
   ID. Exercise the changed flow and an offline cold start.
8. Publish the verified commit to production only after explicit release
   approval, using the production EAS environment.

## Rollback

If an update is unhealthy, stop further rollout and inspect the channel/update
group first. Run the interactive rollback command and select the affected
channel and known-good target:

```bash
bunx eas-cli update:rollback
```

Alternatively, republish a previously verified update group so it becomes the
latest update on the branch:

```bash
bunx eas-cli update:republish --group <KNOWN_GOOD_UPDATE_GROUP_ID>
```

After rollback or republish, verify the channel/branch state and repeat the
force-close/relaunch check. A rollback cannot make native-incompatible JavaScript
safe; if the runtime changed, ship a corrected binary.
