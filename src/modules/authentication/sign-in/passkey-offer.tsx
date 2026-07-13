import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUser } from '@clerk/expo';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const BENEFITS = [
  'Faster — one look and you’re in',
  'Safer than a password',
  'Only works on your own phone',
] as const;

type Phase = 'offer' | 'busy' | 'success' | 'error';

interface PasskeyOfferProps {
  readonly onDone: () => void;
  // Label for the button shown after Face ID is turned on. Onboarding continues
  // to the next step, so it reads "Continue" there rather than "Go to the forum".
  readonly continueLabel?: string;
}

export function PasskeyOffer({
  continueLabel = 'Go to the forum',
  onDone,
}: PasskeyOfferProps) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('offer');

  const createPasskey = async () => {
    if (!user) {
      onDone();
      return;
    }
    setPhase('busy');
    try {
      await user.createPasskey();
      setPhase('success');
    } catch {
      setPhase('error');
    }
  };

  return (
    <View
      className="flex-1 bg-canvas px-6"
      style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 24 }}
    >
      {phase === 'success' ? (
        <Centered
          body="Next time you open the app, Face ID signs you in. Nothing to type."
          icon="CheckCircle"
          iconColor="rgb(34,197,94)"
          iconTint="rgba(34,197,94,0.12)"
          title="You’re all set"
        >
          <Button
            className="h-[52px] w-full rounded-full bg-primary"
            onPress={onDone}
            size="lg"
          >
            <ButtonText className="font-inter-semibold text-[15px] text-primary-foreground">
              {continueLabel}
            </ButtonText>
          </Button>
        </Centered>
      ) : phase === 'error' ? (
        <Centered
          body="No problem — you can turn on Face ID later in Settings. Your password still works."
          icon="AlertCircle"
          iconColor="rgb(113,113,123)"
          iconTint="rgb(245,245,245)"
          title="That didn’t finish"
        >
          <VStack className="w-full" space="sm">
            <Button
              className="h-[52px] w-full rounded-full bg-primary"
              onPress={createPasskey}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-[15px] text-primary-foreground">
                Try again
              </ButtonText>
            </Button>
            <Button
              className="h-[44px] w-full rounded-full bg-transparent"
              onPress={onDone}
              size="lg"
              variant="link"
            >
              <ButtonText className="font-inter-medium text-[15px] text-muted-foreground">
                Skip for now
              </ButtonText>
            </Button>
          </VStack>
        </Centered>
      ) : (
        <View className="flex-1">
          <View className="flex-1 justify-center">
            <VStack space="xl">
              <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-indigo-subtle">
                <Icon color="rgb(99,102,241)" name="Lock" size={30} />
              </View>
              <VStack space="sm">
                <Heading className="font-inter-bold tracking-[-0.6px]" size="2xl">
                  Skip the password next time
                </Heading>
                <Text className="leading-6 text-muted-foreground" size="md">
                  Turn on Face ID so you can sign in with just a look — nothing
                  to type, nothing to remember.
                </Text>
              </VStack>
              <VStack space="md">
                {BENEFITS.map((benefit) => (
                  <View className="flex-row items-center gap-3" key={benefit}>
                    <Icon
                      color="rgb(34,197,94)"
                      name="CheckCircle"
                      size={20}
                    />
                    <Text className="text-content" size="md">
                      {benefit}
                    </Text>
                  </View>
                ))}
              </VStack>
            </VStack>
          </View>
          <VStack space="sm">
            <Button
              className="h-[52px] w-full rounded-full bg-primary"
              isDisabled={phase === 'busy'}
              onPress={createPasskey}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-[15px] text-primary-foreground">
                {phase === 'busy' ? 'Just a moment…' : 'Turn on Face ID'}
              </ButtonText>
            </Button>
            <Button
              className="h-[44px] w-full rounded-full bg-transparent"
              onPress={onDone}
              size="lg"
              variant="link"
            >
              <ButtonText className="font-inter-medium text-[15px] text-muted-foreground">
                Maybe later
              </ButtonText>
            </Button>
          </VStack>
        </View>
      )}
    </View>
  );
}

interface CenteredProps {
  readonly icon: 'CheckCircle' | 'AlertCircle';
  readonly iconColor: string;
  readonly iconTint: string;
  readonly title: string;
  readonly body: string;
  readonly children: React.ReactNode;
}

function Centered({
  icon,
  iconColor,
  iconTint,
  title,
  body,
  children,
}: CenteredProps) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <VStack className="items-center" space="lg">
          <View
            className="h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ backgroundColor: iconTint }}
          >
            <Icon color={iconColor} name={icon} size={34} />
          </View>
          <VStack className="items-center" space="sm">
            <Heading className="text-center font-inter-bold tracking-[-0.5px]" size="xl">
              {title}
            </Heading>
            <Text
              className="max-w-[300px] text-center leading-[22px] text-muted-foreground"
              size="md"
            >
              {body}
            </Text>
          </VStack>
        </VStack>
      </View>
      {children}
    </View>
  );
}
