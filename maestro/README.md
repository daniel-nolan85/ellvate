# Maestro QA

This suite owns native user journeys and simulator behavior. Component state,
API contracts, Supabase adapters, and domain behavior stay in Jest/Bun tests.

## Prerequisites

The repository targets an Expo SDK 54 development client, not Expo Go.

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
maestro --version
bun run ios -- --device <simulator-udid>
bun run start -- --clear --localhost --port 8081
```

`maestro/subflows/launch.yaml` handles the Expo development-client server
picker and its first-run menu. `reset-state.yaml` clears both app state and the
native keychain so Clerk sessions cannot leak between identity flows. This
means each flow may show the server picker once; do not remove `clearKeychain`
from identity-isolation runs.

For an explicit disabled-auth run, use the repository runner. It stops the old
Metro process, starts a clean bundle with the requested auth mode, reloads the
simulator URL, and only then starts Maestro:

```sh
bun run test:maestro:disabled
bun run test:maestro:retry
```

## Clerk test values

Use a development instance with email and phone verification-code factors
enabled, password disabled, and phone not required for every sign-up. Clerk's
reserved values are injected at runtime only:

```sh
maestro test maestro/flows/auth/email-otp.yaml \
  -e MAESTRO_TEST_EMAIL='unique+clerk_test@example.com' \
  -e MAESTRO_TEST_CODE=424242

maestro test maestro/flows/auth/phone-otp.yaml \
  -e MAESTRO_TEST_PHONE=2015550100 \
  -e MAESTRO_TEST_CODE=424242
```

The email must contain `+clerk_test`. The phone variable is entered into the
UI as ten local US digits; the app converts it to E.164. Use a fictional
`+1 (XXX) 555-0100` through `+1 (XXX) 555-0199` number. Never commit the
identities or Clerk credentials to YAML, source, or CI logs.

## Commands

```sh
# Syntax-check all executable flows.
for flow in $(find maestro/flows -name '*.yaml' -print); do
  maestro check-syntax "$flow"
done

# Fast native smoke.
maestro test maestro/flows/smoke/cold-launch.yaml \
  --device <simulator-udid> --no-reinstall-driver

# Disabled-auth smoke with deterministic Metro/runtime switching.
MAESTRO_DEVICE=<simulator-udid> bun run test:maestro:disabled

# UI journeys backed by the explicit local demo store.
MAESTRO_DEVICE=<simulator-udid> bun run test:maestro:ui

# Persist artifacts for CI.
maestro test maestro/flows/smoke \
  --device <simulator-udid> --no-reinstall-driver \
  --debug-output artifacts/maestro --format JUNIT \
  --output artifacts/maestro-smoke.xml
```

## Coverage map

| Area | Executable coverage in this change | External fixture still required |
| --- | --- | --- |
| Cold launch / signed-out auth | `smoke/cold-launch.yaml` | None |
| Disabled auth | `smoke/disabled-auth.yaml` | Metro started with disabled mode |
| Email OTP | `auth/email-otp.yaml` | Clerk development factors and injected test email |
| Phone OTP | `auth/phone-otp.yaml` | Clerk development factors and injected test phone |
| Authenticated comments | `forum/comments-clerk.yaml` | Fresh Clerk phone identity and Supabase demo seed |
| Onboarding completion | `onboarding/complete-demo.yaml` | Disabled-auth runtime |
| Profile-sync retry | `onboarding/retry-profile-sync.yaml` | `MAESTRO_PROFILE_SYNC_FAIL_ONCE=true` in non-production Metro |
| Forum / events / missions | Demo-store UI CRUD validation | Live Supabase/RLS gate plus seeded staging flow |
| Leaderboard | Demo-store navigation | Authenticated session plus seeded ranking data |
| Assistant | Demo-store open/search | Authenticated session and configured assistant backend |
| Push | Simulator no-op contract | Physical device for token delivery |

The section and CRUD flows intentionally assert stable selectors and validation
surfaces; they do not fabricate successful writes when Supabase fixtures are
absent. The next integration stage should provision a disposable Supabase
project/seed and add failure injection for network, RLS, and profile-sync cases.

## CI policy

Run `bun run check`, `bun run test:components`, and the syntax check on every
change. Run smoke plus email/phone OTP on the iOS simulator for every merge.
Run the full seeded Supabase flow set nightly and on release candidates. Upload
the Maestro JUnit report, debug logs, screenshots, and the native simulator log
on failure. Push delivery must be verified on a physical device; simulator
registration is only a no-crash/no-op check.
