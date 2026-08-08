import { View } from 'react-native';

import {
  AuthenticationStateScreen,
  SignInScreen,
} from '@/src/modules/authentication';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Text } from '@/src/components/ui/text';
import { useSession } from '@/src/platform/session';

interface AuthStepProps {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

// Real Clerk sign-in / sign-up uses passwordless email or phone OTP. Onboarding
// navigation skips this slot once a session is active, so it only ever renders
// for a signed-out visitor; pressing back returns to welcome.
export function AuthStep({ onBack, onNext }: AuthStepProps) {
  const session = useSession();

  if (session.status === 'disabled') {
    return (
      <View className="flex-1 justify-center gap-6 bg-canvas px-6">
        <View className="gap-2">
          <Heading size="2xl">Authentication is disabled</Heading>
          <Text className="text-muted-foreground" size="md">
            This development build uses the local demo backend. You can continue
            without creating an account.
          </Text>
        </View>
        <Button
          className="bg-accent data-[hover=true]:bg-accent data-[active=true]:bg-accent"
          onPress={onNext}
          testID="auth-demo-continue"
        >
          <ButtonText className="text-accent-foreground data-[hover=true]:text-accent-foreground data-[active=true]:text-accent-foreground">
            Continue
          </ButtonText>
        </Button>
      </View>
    );
  }

  if (session.status === 'misconfigured') {
    return <AuthenticationStateScreen />;
  }

  return <SignInScreen onAuthenticated={onNext} onExit={onBack} />;
}
