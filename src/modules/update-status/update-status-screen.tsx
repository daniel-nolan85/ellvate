import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  bootstrapExpoUpdates,
  getExpoUpdateDiagnostics,
  getRecentExpoUpdateFailures,
  type ExpoUpdateBootstrapResult,
  type ExpoUpdateFailureDiagnostic,
} from '@/src/platform/updates';

// Temporary, unlinked debug screen -- no nav entry point points here on
// purpose. Reached only via the app's own URL scheme (see APP_SCHEME in
// .env.example), so it stays out of the way of real users while still being
// reachable on a physical device with no Mac/Xcode available to read native
// update logs any other way.

function StatusRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <HStack className="items-start justify-between gap-4 border-b border-surface-hairline py-2.5">
      <Text className="flex-1 text-text-muted" size="sm">
        {label}
      </Text>
      <Text className="max-w-[65%] text-right text-content" size="sm">
        {value}
      </Text>
    </HStack>
  );
}

export function UpdateStatusScreen() {
  const insets = useSafeAreaInsets();
  const [diagnostics, setDiagnostics] = useState(() => getExpoUpdateDiagnostics());
  const [failures, setFailures] = useState<readonly ExpoUpdateFailureDiagnostic[]>([]);
  const [checkResult, setCheckResult] = useState<ExpoUpdateBootstrapResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const refresh = useCallback(async () => {
    setDiagnostics(getExpoUpdateDiagnostics());
    setFailures(await getRecentExpoUpdateFailures());
  }, []);

  const checkNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await bootstrapExpoUpdates();
      setCheckResult(result);
      await refresh();
    } finally {
      setIsChecking(false);
    }
  }, [refresh]);

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center gap-2 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityLabel="Back" onPress={() => router.back()}>
          <Icon name="ChevronLeft" size={22} />
        </Pressable>
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Update status
        </Heading>
      </HStack>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <VStack space="lg">
          <VStack space="xs">
            <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
              Current launch
            </Text>
            <StatusRow label="EAS Update enabled" value={String(diagnostics.isEnabled)} />
            <StatusRow label="Channel" value={diagnostics.channel ?? '—'} />
            <StatusRow label="Runtime version" value={diagnostics.runtimeVersion ?? '—'} />
            <StatusRow
              label="Embedded launch (never updated)"
              value={String(diagnostics.isEmbeddedLaunch)}
            />
            <StatusRow label="Active update ID" value={diagnostics.updateId ?? '(embedded)'} />
            <StatusRow label="Update created at" value={diagnostics.createdAt ?? '—'} />
            <StatusRow label="Emergency launch" value={String(diagnostics.isEmergencyLaunch)} />
            {diagnostics.emergencyLaunchReason ? (
              <StatusRow
                label="Emergency reason"
                value={diagnostics.emergencyLaunchReason}
              />
            ) : null}
          </VStack>

          {failures.length > 0 ? (
            <VStack space="xs">
              <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
                Recent native update failures
              </Text>
              {failures.map((failure, index) => (
                <Text
                  className="text-destructive"
                  key={`${failure.code}-${index}`}
                  size="xs"
                >
                  [{failure.level}/{failure.code}] {failure.message}
                </Text>
              ))}
            </VStack>
          ) : null}

          {checkResult ? (
            <VStack space="xs">
              <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
                Last manual check result
              </Text>
              <Text className="text-content" size="sm">
                {checkResult.status}
                {checkResult.error ? ` — ${checkResult.error}` : ''}
              </Text>
            </VStack>
          ) : null}

          <Button isDisabled={isChecking} onPress={() => void checkNow()}>
            <ButtonText>{isChecking ? 'Checking…' : 'Check for update now'}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </View>
  );
}
