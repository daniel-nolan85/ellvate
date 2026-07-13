import type { ReactNode } from 'react';

import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

interface ScreenTitleProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly right?: ReactNode;
}

export function ScreenTitle({ eyebrow, title, right }: ScreenTitleProps) {
  return (
    <HStack className="items-end gap-2 px-5 pb-1 pt-2">
      <VStack className="flex-1 gap-1">
        <Text className="font-inter-bold uppercase text-indigo text-[11px] tracking-[1.2px]">
          {eyebrow}
        </Text>
        <Heading className="font-inter-bold tracking-[-0.9px]" size="2xl">
          {title}
        </Heading>
      </VStack>
      {right}
    </HStack>
  );
}
