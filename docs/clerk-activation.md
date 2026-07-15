# Clerk activation gate

The provider, token cache, session contract, and route gate are already part of
the starter. The sign-in experience is intentionally not selected for copied
apps.

## LLV custom OTP flow

| Flow | Best when | Native requirements |
| --- | --- | --- |
| Prebuilt `AuthView` / `UserButton` | Fastest path and Clerk-owned auth UI | `@clerk/expo` config plugin and a development build; not Expo Go |
| Custom hooks + gluestack UI | The app needs exact branded copy, steps, and validation | Inspect enabled factors first; browser SSO needs scheme/redirect configuration; native Apple/Google needs a development build |

LLV uses one branded custom flow with a phone/email selector and passwordless
verification codes. It uses the current `useSignIn` and `useSignUp` APIs; do not
use deprecated `useOAuth` APIs. The Clerk development instance must enable both
email-code and phone-code factors.

## Activation checklist

1. Create or select the Clerk development instance.
2. Decide prebuilt or custom auth.
3. Add the real publishable key to the development EAS environment as
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and set
   `EXPO_PUBLIC_AUTH_MODE=clerk`. Never add a Clerk secret key to the client.
4. For a custom flow, derive the Frontend API domain from the publishable key,
   inspect `/v1/environment?_is_native=true`, and list every enabled factor and
   strategy before building screens.
5. Configure the stable app scheme and every OAuth/SSO redirect in Clerk.
6. Build a new development client because the Clerk config plugin is native
   configuration.
7. Verify loading, signed-out, signed-in, sign-out, cancelled OAuth, incomplete
   verification, and session restoration states.
8. Verify an authenticated API call and confirm identity change/sign-out clears
   in-memory and persisted TanStack data.
9. Run the email and phone flows with Clerk test identities and code `424242`.
10. Run the flow on each supported native platform; native Clerk views are not
   proven by Jest or Expo Go.

The default disabled mode is a configuration state, not a fake signed-in user.
It exists so the rest of a copied app can be developed and tested before an
external Clerk instance is authorized.
