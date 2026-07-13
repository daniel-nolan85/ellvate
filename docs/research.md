# Context7 research: Expo SDK 54 starter

Research date: 2026-07-10

The target is Expo SDK 54 so every copy starts from one deliberate, reproducible
native baseline. Context7 was used first for every library. The installed
package graph and Expo compatibility checks were then used to turn documentation
guidance into exact starter versions.

## Expo, Router, and EAS Update

Context7 libraries:

- `/expo/expo/__branch__sdk-54`
- `/websites/expo_dev_versions_v54_0_0`

Selected baseline:

| Concern | Pinned baseline |
| --- | --- |
| Expo | `~54.0.35` |
| React | `19.1.0` |
| React Native | `0.81.5` |
| Expo Router | `~6.0.24` |
| Expo Updates | `~29.0.18` |
| Expo Dev Client | `~6.0.21` |
| Node | `20.19.x` through Node 22 |
| Bun | `1.3.13` |

SDK 54 keeps routes in the root `app/` directory. Route files should only
register navigation, guards, and module screens. Typed routes and the New
Architecture remain enabled as starter defaults.

EAS Update uses `runtimeVersion.policy = "appVersion"`. An update is eligible
only when platform, runtime version, and the binary's embedded channel all
match. SDK 54 has a particularly important environment rule: if `eas update`
omits `--environment`, the export can consume local dotenv files. This project
therefore requires both an EAS environment and `--clear-cache` for update
publishes. See [ota-updates.md](./ota-updates.md).

Primary references:

- [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/)
- [Expo Router 6](https://docs.expo.dev/versions/v54.0.0/sdk/router/)
- [Expo Updates](https://docs.expo.dev/versions/v54.0.0/sdk/updates/)
- [EAS environment variable usage](https://docs.expo.dev/eas/environment-variables/usage/)

## TanStack Query

Context7 library: `/tanstack/query`

The starter uses TanStack Query v5.101.0 for server state. The provider:

- keeps one stable production `QueryClient`;
- maps React Native connectivity through NetInfo and foreground state through
  `AppState`;
- uses a 60-second starter `staleTime` and a 24-hour `gcTime`/persisted
  `maxAge`;
- retries reads twice and does not retry writes by default;
- restores through `PersistQueryClientProvider` so queries do not race the
  asynchronous cache restore;
- persists only successful queries that explicitly set `meta.persist = true`;
- refuses persistence when `meta.sensitive = true`;
- never persists mutations by default.

`QUERY_CACHE_BUSTER` protects serialized server-state compatibility. It is
deliberately independent from EAS `runtimeVersion`: native compatibility and
cached API-shape compatibility fail for different reasons. Do not erase the
cache on every OTA update; bump the buster only when persisted query semantics
or tenancy boundaries become incompatible.

Primary references:

- [TanStack React Native guide](https://github.com/TanStack/query/blob/main/docs/framework/react/react-native.md)
- [AsyncStorage persister](https://github.com/TanStack/query/blob/main/docs/framework/react/plugins/createAsyncStoragePersister.md)
- [Persist Query Client](https://github.com/TanStack/query/blob/main/docs/framework/react/plugins/persistQueryClient.md)

## gluestack-ui

Context7 library: `/gluestack/gluestack-ui/v3.0.0`

The stable target is gluestack-ui v3 with NativeWind v4 and Tailwind CSS v3.
Components are generated into `src/components/ui` and owned as local source;
feature code imports these local primitives instead of a monolithic themed
package.

The CLI must be pinned:

```bash
bunx gluestack-ui@3.0.12 init \
  --use-bun \
  --path src/components/ui \
  --projectType expo
```

On the research date, unpinned `gluestack-ui@latest` selected a v5 alpha,
silently fell back to NativeWind 5 preview/Tailwind 4, and was rolled back. Do
not replace the v3 pin with `@latest` without a deliberate migration and native
verification.

The legacy `@gluestack-ui/themed`, `@gluestack-style/react`, and
`@gluestack-ui/config` setup is not used.

## Clerk Expo

Context7 library: `/clerk/clerk-docs`

The starter pins `@clerk/expo` 3.2.15; its peer range supports Expo 53 through
55, including SDK 54. The reusable integration boundary owns:

- `ClerkProvider` from `@clerk/expo`;
- `tokenCache` from `@clerk/expo/token-cache`;
- mapping Clerk's loaded/signed-in state to an app-facing session contract;
- clearing user-scoped server state when identity changes.

The starter defaults to `EXPO_PUBLIC_AUTH_MODE=disabled` so it boots without
credentials. Setting the mode to `clerk` requires a real publishable key and
fails visibly when it is absent or malformed. No secret key may use an
`EXPO_PUBLIC_` name.

The starter intentionally does not choose a sign-in UI. Native prebuilt
`AuthView`/`UserButton` and custom gluestack hook-driven auth have different
requirements and cannot be honestly activated until a Clerk development
instance, enabled factors, redirect URLs, and a flow choice exist. See
[clerk-activation.md](./clerk-activation.md).

Primary references:

- [Clerk Expo overview](https://clerk.com/docs/reference/expo/overview)
- [Clerk Expo quickstart](https://clerk.com/docs/getting-started/quickstart)

## Local verification evidence

The finished starter passed the repository type, lint, test, and architecture
gates. `expo install --check` reported compatible dependencies,
`expo-doctor` passed all checks, and a static export completed for iOS, Android,
and web. A browser smoke check also exercised the readiness, auth-disabled, and
protected-route states without console errors.

These checks validate this repository as generated. Each copied app must repeat
them after changing its app identity, native configuration, dependencies, auth
provider settings, or EAS project linkage.
