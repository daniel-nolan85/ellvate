# Architecture and implementation plan

This starter uses semantic ownership and narrow public APIs. Expo Router is the
composition edge; app behavior does not live in route files.

## Dependency map

```text
app/ routes and guards
  -> src/modules/* public APIs
  -> src/platform/providers
       -> platform/session, query, updates, environment
       -> services/clerk and services/api public APIs
       -> components/ui gluestack primitives

modules/*
  -> components/ui primitives
  -> platform public APIs
  -> service public APIs

services/*
  -> vendor SDK and transport details only
```

## Ownership

| Path | Owner | Rules |
| --- | --- | --- |
| `app/` | Expo Router | Routes, groups, guards, and screen registration only |
| `src/modules/` | App capabilities | Domain UI, hooks, query definitions, and behavior |
| `src/platform/environment` | Expo runtime config | Public environment parsing and safe configuration states |
| `src/platform/query` | Server-state runtime | Query client, persistence, NetInfo/AppState adapters, cache clearing |
| `src/platform/session` | App session contract | Vendor-neutral auth state and token/sign-out capabilities |
| `src/platform/updates` | Native update runtime | EAS Update bootstrap and diagnostics |
| `src/services/api` | HTTP adapter | Base URL, auth header injection, JSON normalization, typed errors |
| `src/services/clerk` | Clerk adapter | Clerk provider, token cache, and session-state normalization |
| `src/components/ui` | Design-system primitives | gluestack-generated, domain-neutral, source-owned components |

Cross-boundary consumers import public `index.ts` files. Vendor imports stay in
their adapter. User or organization identifiers belong in every user-scoped
query key, and sign-out or identity changes must clear both memory and the
persisted query snapshot.

## Provider order

The root provider composition is intentionally explicit:

1. gluestack UI provider establishes design tokens and overlay/toast context.
2. the session provider selects disabled, misconfigured, or Clerk-backed mode;
3. the TanStack provider restores approved server state and installs native
   lifecycle listeners;
4. the update bootstrap runs once and never crashes app startup.

The session and query boundaries remain separate. Clerk owns credentials;
TanStack owns server state. Authentication changes may invalidate the query
cache, but TanStack does not persist Clerk tokens.

## Delivery phases

### Phase 1: foundation

- Pin Expo SDK 54-compatible native package versions.
- Initialize stable gluestack v3 and generate only used primitives.
- Add typed environment, API, session, query, and update boundaries.
- Keep auth disabled and OTA disabled until external project identifiers exist.

### Phase 2: app wiring

- Replace or extend the readiness example with the first real app capability.
- Point `EXPO_PUBLIC_API_URL` at the intended environment.
- Mark only reviewed, non-sensitive queries as persistent.
- Select Clerk prebuilt or custom auth and implement it against the actual
  enabled-factor response.

### Phase 3: release activation

- Choose unique native app identifiers and a unique deep-link scheme for the
  copied app.
- Run `eas init` and place that app's unique project ID in its EAS environments.
- Build a development client after native/config-plugin changes.
- Prove sign-in, session restore, API authorization, cache clearing, and route
  guards against a Clerk development instance.
- Build and validate `preview`, perform an OTA marker and rollback drill, then
  enable production publishing.

## Non-goals

- No fake Clerk user, development auth bypass, or committed credential.
- No global offline mutation queue; each queued write needs idempotency and a
  registered mutation default.
- No EAS project creation, build, publish, submission, or production mutation.
- No claim that the prebuilt and custom Clerk flows are interchangeable.
