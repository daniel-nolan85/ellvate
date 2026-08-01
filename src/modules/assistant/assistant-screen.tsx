import { useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiMark } from '@/src/components/ui/ai-mark';
import { Box } from '@/src/components/ui/box';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { Composer } from './composer';
import { MessageBubble } from './message-bubble';
import { SuggestionChips } from './suggestion-chips';
import { ThinkingIndicator } from './thinking-indicator';
import { useAssistantChat } from './use-assistant-chat';

interface AssistantScreenProps {
  readonly onClose: () => void;
}

export function AssistantScreen({ onClose }: AssistantScreenProps) {
  const { entries, isSending, sendMessage, suggestions } = useAssistantChat();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [entries.length, isSending]);

  const pendingReply =
    isSending && entries[entries.length - 1]?.kind === 'user';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas"
      style={{ paddingBottom: insets.bottom }}
    >
      <HStack
        className="items-center gap-2 border-b border-line px-5 pb-3 pt-4"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Box className="h-9 w-9 items-center justify-center rounded-[12px] bg-accent">
          <AiMark color="#ffffff" size={18} />
        </Box>
        <VStack className="flex-1 gap-0.5">
          <Text className="font-inter-bold text-content" size="sm">
            Lake Assistant
          </Text>
        </VStack>
        <Pressable
          accessibilityLabel="Close assistant"
          className="h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary"
          onPress={onClose}
        >
          <Icon name="Close" size={16} />
        </Pressable>
      </HStack>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3.5 p-5"
        ref={scrollRef}
      >
        {entries.length === 0 && !pendingReply ? (
          <VStack className="items-center gap-2.5 px-6 pt-16">
            <Box className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              <AiMark color="#ffffff" size={26} />
            </Box>
            <Text className="text-center font-inter-bold text-content" size="lg">
              Ask the Lake Assistant
            </Text>
            <Text
              className="max-w-[280px] text-center leading-[20px] text-text-muted"
              size="sm"
            >
              Events, missions, local businesses, or what neighbours are
              posting around Lake Las Vegas — just ask.
            </Text>
          </VStack>
        ) : null}
        {entries.map((entry, index) => (
          <MessageBubble
            key={`${index}-${entry.kind}`}
            kind={entry.kind}
            text={entry.text}
          />
        ))}
        {pendingReply ? <ThinkingIndicator /> : null}
      </ScrollView>
      <SuggestionChips onSelect={sendMessage} suggestions={suggestions} />
      <Composer isSending={isSending} onSend={sendMessage} />
    </KeyboardAvoidingView>
  );
}
