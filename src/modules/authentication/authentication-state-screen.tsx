import { Box } from '@/src/components/ui/box';
import { Card } from '@/src/components/ui/card';
import { Heading } from '@/src/components/ui/heading';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { useSession, type AppSession } from '@/src/platform/session';

interface AuthenticationStateCopy {
  readonly body: string;
  readonly title: string;
}

const copyForSession = (session: AppSession): AuthenticationStateCopy => {
  switch (session.status) {
    case 'disabled':
      return {
        title: 'Authentication is disabled',
        body:
          'The app is running without an identity provider. Enable Clerk in the public environment when you are ready to choose a sign-in experience.',
      };
    case 'loading':
      return {
        title: 'Restoring your session',
        body: 'Checking the secure session cache before the app continues.',
      };
    case 'signed-out':
      return {
        title: 'Authentication required',
        body:
          'Clerk is connected, but this boilerplate does not choose a sign-in experience for you. Select a prebuilt or custom flow before adding a sign-in action.',
      };
    case 'misconfigured':
      return {
        title: 'Authentication setup required',
        body: session.message,
      };
    case 'signed-in':
      return {
        title: 'Session ready',
        body: 'The authenticated session is available.',
      };
  }
};

export function AuthenticationStateScreen() {
  const session = useSession();
  const copy = copyForSession(session);

  return (
    <Box className="flex-1 items-center justify-center bg-background-0 px-6 py-10">
      <Card className="w-full max-w-lg border border-outline-200 bg-background-0">
        <VStack space="lg">
          {session.status === 'loading' ? (
            <Spinner className="text-primary-500" size="large" />
          ) : null}
          <VStack space="sm">
            <Heading className="text-typography-950" size="xl">
              {copy.title}
            </Heading>
            <Text className="text-typography-600" size="md">
              {copy.body}
            </Text>
          </VStack>
          {session.status === 'misconfigured' ? (
            <Text className="text-typography-500" size="sm">
              No secret key or placeholder session is embedded in this app.
            </Text>
          ) : null}
        </VStack>
      </Card>
    </Box>
  );
}
