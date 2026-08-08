import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

interface ObProgressProps {
  readonly step: number;
  readonly total: number;
}

export function ObProgress({ step, total }: ObProgressProps) {
  return (
    <View className="flex-row gap-1 px-5">
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-muted'}`}
        />
      ))}
    </View>
  );
}

interface ObHeaderProps {
  readonly step: number;
  readonly total: number;
  readonly onBack?: () => void;
  readonly onSkip?: () => void;
  readonly skippable?: boolean;
}

export function ObHeader({ step, total, onBack, onSkip, skippable }: ObHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="gap-3.5 pt-2" style={{ paddingTop: insets.top + 8 }}>
      <View className="min-h-[34px] flex-row items-center justify-between px-3.5">
        {onBack ? (
          <Pressable
            accessibilityLabel="Onboarding back"
            accessibilityRole="button"
            className="h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary"
            onPress={onBack}
            testID="onboarding-back"
          >
            <Icon name="ArrowLeft" size={16} />
          </Pressable>
        ) : (
          <View className="w-[34px]" />
        )}
        {skippable ? (
          <Pressable
            accessibilityLabel="Skip onboarding step"
            accessibilityRole="button"
            className="px-2 py-1.5"
            onPress={onSkip}
            testID="onboarding-skip"
          >
            <Text className="font-inter-medium text-[13px] text-text-subtle">Skip</Text>
          </Pressable>
        ) : null}
      </View>
      <ObProgress step={step} total={total} />
    </View>
  );
}

interface ObTitleProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly sub?: string;
}

export function ObTitle({ eyebrow, title, sub }: ObTitleProps) {
  return (
    <VStack className="px-6 pb-1 pt-[18px]" space="xs">
      {eyebrow ? (
        <Text className="font-inter-bold text-[11px] uppercase tracking-[1.2px] text-accent">
          {eyebrow}
        </Text>
      ) : null}
      <Heading className="font-inter-bold tracking-tight" size="xl">
        {title}
      </Heading>
      {sub ? (
        <Text className="leading-[21px] text-muted-foreground" size="sm">
          {sub}
        </Text>
      ) : null}
    </VStack>
  );
}

interface ObCtaProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export function ObCta({ label, onPress, disabled }: ObCtaProps) {
  return (
    <View className="mt-auto px-5 pb-2 pt-3">
      <Button
        className="h-[52px] w-full rounded-full bg-accent data-[hover=true]:bg-accent data-[active=true]:bg-accent"
        isDisabled={disabled}
        onPress={onPress}
        testID={`onboarding-cta-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        size="lg"
      >
        <ButtonText className="font-inter-semibold text-[15px] text-accent-foreground data-[hover=true]:text-accent-foreground data-[active=true]:text-accent-foreground">
          {label}
        </ButtonText>
      </Button>
    </View>
  );
}
