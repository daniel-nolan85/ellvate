import {
  AuthenticationStateScreen,
  RequireAuthentication,
} from '@/src/modules/authentication';

export default function ProtectedRoute() {
  return (
    <RequireAuthentication>
      <AuthenticationStateScreen />
    </RequireAuthentication>
  );
}
