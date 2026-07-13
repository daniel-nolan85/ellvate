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
import { ToolCallChip } from './tool-call-chip';
import { useAssistantChat } from './use-assistant-chat';

const INDIGO = 'rgb(99,102,241)';

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
        <Box className="h-9 w-9 items-center justify-center rounded-[12px] bg-primary">
          <AiMark color={INDIGO} size={18} />
        </Box>
        <VStack className="flex-1 gap-0.5">
          <Text className="font-inter-bold text-content" size="sm">
            Lake Assistant
          </Text>
          <HStack className="items-center gap-1">
            <Box className="h-[6px] w-[6px] rounded-full bg-success" />
            <Text className="text-text-muted" size="xs">
              Connected to events · forum · missions
            </Text>
          </HStack>
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
        {entries.map((entry, index) =>
          entry.kind === 'tool' ? (
            <ToolCallChip
              isActive={isSending && index === entries.length - 1}
              key={`${index}-${entry.tool}`}
              tool={entry.tool}
            />
          ) : (
            <MessageBubble
              key={`${index}-${entry.kind}`}
              kind={entry.kind}
              text={entry.text}
            />
          ),
        )}
        {pendingReply ? (
          <ToolCallChip isActive tool="search" />
        ) : null}
      </ScrollView>
      <SuggestionChips onSelect={sendMessage} suggestions={suggestions} />
      <Composer isSending={isSending} onSend={sendMessage} />
    </KeyboardAvoidingView>
  );
}
