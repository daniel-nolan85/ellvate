import { Platform } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';

const ACCENT = 'rgb(181,80,44)';

const MONO_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});

interface ToolCallChipProps {
  readonly tool: string;
  readonly isActive: boolean;
}

export function ToolCallChip({ isActive, tool }: ToolCallChipProps) {
  return (
    <HStack className="items-center gap-1.5 self-start">
      {isActive ? (
        <Spinner color={ACCENT} size="small" />
      ) : (
        <Icon color={ACCENT} name="Check" size={12} />
      )}
      <Text
        className="rounded-full bg-secondary px-2.5 py-[5px] text-[11px] text-text-muted"
        testID={`assistant-tool-${tool}`}
        style={{ fontFamily: MONO_FONT_FAMILY }}
      >
        {`${tool}()`}
      </Text>
    </HStack>
  );
}
