export { AuthenticationProvider } from './authentication-provider';
export { ClerkAuthGate } from './clerk-auth-gate';
export { AuthenticationStateScreen } from './authentication-state-screen';
export { SignInScreen } from './sign-in/sign-in-screen';
export { CodeInput } from './sign-in/code-input';
export { PasskeyOffer } from './sign-in/passkey-offer';
export {
  isMissingIdentifierError,
  messageForAuthError,
} from './sign-in/auth-errors';
export {
  canAccessCommunityRoutes,
  getAuthenticationGateDecision,
  RequireAuthentication,
  type AuthenticationGateDecision,
} from './require-authentication';
