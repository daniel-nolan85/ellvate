import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { publicEnvironment } from '@/src/platform/environment';
import { useSession } from '@/src/platform/session';
import { getExpoUpdateDiagnostics } from '@/src/platform/updates';

import { useApiReadiness } from './use-api-readiness';

interface ReadinessScreenProps {
  readonly onOpenAuthentication: () => void;
  readonly onOpenProtectedExample: () => void;
}

function StatusRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <HStack className="items-start justify-between gap-4">
      <Text className="flex-1 text-typography-600" size="sm">
        {label}
      </Text>
      <Text className="max-w-[60%] text-right text-typography-900" size="sm">
        {value}
      </Text>
    </HStack>
  );
}

export function ReadinessScreen({
  onOpenAuthentication,
  onOpenProtectedExample,
}: ReadinessScreenProps) {
  const session = useSession();
  const apiReadiness = useApiReadiness();
  const updateDiagnostics = getExpoUpdateDiagnostics();

  const apiStatus = !publicEnvironment.apiUrl
    ? 'Ready to wire'
    : apiReadiness.isPending
      ? 'Checking /health'
      : apiReadiness.isSuccess
        ? 'Connected'
        : 'Unreachable';

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Box className="mx-auto w-full max-w-3xl px-5 py-8">
          <VStack space="2xl">
            <VStack space="sm">
              <Text className="font-semibold uppercase tracking-widest text-primary-600" size="xs">
                Expo SDK 54 · reusable starter
              </Text>
              <Heading className="text-typography-950" size="3xl">
                App foundation
              </Heading>
              <Text className="max-w-2xl text-typography-600" size="md">
                Expo Router, gluestack-ui v3, TanStack Query persistence,
                Clerk session boundaries, and EAS Update are composed and ready
                for real environment values.
              </Text>
            </VStack>

            <Card className="border border-outline-200 bg-background-0">
              <VStack space="md">
                <Heading className="text-typography-900" size="lg">
                  Runtime contract
                </Heading>
                <StatusRow label="Expo" value="54.0.35" />
                <StatusRow label="React Native" value="0.81.5" />
                <StatusRow label="Package manager" value="Bun 1.3.13" />
                <StatusRow label="UI system" value="gluestack v3 / NativeWind v4" />
              </VStack>
            </Card>

            <Card className="border border-outline-200 bg-background-0">
              <VStack space="md">
                <Heading className="text-typography-900" size="lg">
                  Integration state
                </Heading>
                <StatusRow label="Authentication" value={session.status} />
                <StatusRow label="API" value={apiStatus} />
                <StatusRow
                  label="EAS Update"
                  value={
                    updateDiagnostics.isEnabled && updateDiagnostics.channel
                      ? `enabled on ${updateDiagnostics.channel}`
                      : 'awaiting linked release build'
                  }
                />
                <StatusRow
                  label="Runtime version"
                  value={updateDiagnostics.runtimeVersion ?? 'development'}
                />
                <StatusRow
                  label="Environment issues"
                  value={String(publicEnvironment.issues.length)}
                />
                {apiReadiness.isFetching ? <Spinner size="small" /> : null}
              </VStack>
            </Card>

            <HStack className="flex-wrap gap-3">
              <Button onPress={onOpenAuthentication} size="lg">
                <ButtonText>View auth state</ButtonText>
              </Button>
              <Button
                action="secondary"
                onPress={onOpenProtectedExample}
                size="lg"
                variant="outline"
              >
                <ButtonText>Test protected route</ButtonText>
              </Button>
              {publicEnvironment.apiUrl ? (
                <Button
                  action="secondary"
                  isDisabled={apiReadiness.isFetching}
                  onPress={() => void apiReadiness.refetch()}
                  size="lg"
                  variant="link"
                >
                  <ButtonText>Retry API health</ButtonText>
                </Button>
              ) : null}
            </HStack>
          </VStack>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
