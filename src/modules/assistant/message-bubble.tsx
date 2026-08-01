import { Box } from '@/src/components/ui/box';
import { Text } from '@/src/components/ui/text';

interface MessageBubbleProps {
  readonly kind: 'user' | 'assistant';
  readonly text: string;
}

export function MessageBubble({ kind, text }: MessageBubbleProps) {
  const isUser = kind === 'user';

  return (
    <Box
      className={
        isUser
          ? 'max-w-[84%] self-end rounded-[18px] rounded-br-[4px] bg-accent px-[15px] py-[11px]'
          : 'max-w-[84%] self-start rounded-[18px] rounded-bl-[4px] bg-secondary px-[15px] py-[11px]'
      }
    >
      <Text
        className={
          isUser
            ? 'font-sans text-[14px] leading-[21px] text-accent-foreground'
            : 'font-sans text-[14px] leading-[21px] text-content'
        }
      >
        {text}
      </Text>
    </Box>
  );
}
