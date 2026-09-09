import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { useSubmitContactMessage, type ContactCategory } from './use-contact';

const CATEGORIES: readonly { readonly value: ContactCategory; readonly label: string }[] = [
  { label: 'Bug report', value: 'bug' },
  { label: 'Feedback', value: 'feedback' },
  { label: 'Question', value: 'question' },
  { label: 'Other', value: 'other' },
];

export function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ContactCategory>('feedback');
  const [message, setMessage] = useState('');
  const submit = useSubmitContactMessage();

  const handleSend = () => {
    if (!message.trim()) {
      return;
    }
    submit.mutate(
      { category, message: message.trim() },
      { onSuccess: () => setMessage('') },
    );
  };

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
          Contact us
        </Heading>
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
      <ScrollView
        contentContainerClassName="gap-5 px-[18px] py-5"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {submit.isSuccess ? (
          <VStack className="items-center gap-2 rounded-[16px] border border-line bg-paper py-8">
            <Icon color="rgb(74,141,98)" name="CheckCircle" size={28} />
            <Text className="font-inter-semibold text-[15px] text-content">Message sent</Text>
            <Text className="px-6 text-center text-[13px] text-text-muted">
              Thanks for reaching out — a moderator will follow up if needed.
            </Text>
            <Button onPress={() => router.back()} variant="outline">
              <ButtonText>Back to profile</ButtonText>
            </Button>
          </VStack>
        ) : (
          <>
            <Text className="text-[14px] leading-[20px] text-text-muted">
              Reporting a specific post, comment, or listing? Use the report
              option on that item instead — this goes straight to the
              moderators for anything else.
            </Text>

            <VStack space="xs">
              <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
                Category
              </Text>
              <HStack className="flex-wrap gap-2">
                {CATEGORIES.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === option.value }}
                    className={`rounded-full px-3.5 py-2 ${
                      category === option.value ? 'bg-accent' : 'bg-secondary'
                    }`}
                    key={option.value}
                    onPress={() => setCategory(option.value)}
                  >
                    <Text
                      className={`font-inter-medium text-[13px] ${
                        category === option.value ? 'text-accent-foreground' : 'text-content'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>

            <VStack space="xs">
              <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
                Message
              </Text>
              <GrowingTextInput
                className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
                maxLength={2000}
                minHeight={120}
                onChangeText={setMessage}
                placeholder="What's on your mind?"
                value={message}
              />
            </VStack>

            {submit.isError ? (
              <Text className="text-[13px] text-danger">
                Couldn&apos;t send your message. Try again.
              </Text>
            ) : null}

            <Button
              className="h-[52px] rounded-2xl bg-accent"
              isDisabled={!message.trim() || submit.isPending}
              onPress={handleSend}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-accent-foreground">
                {submit.isPending ? 'Sending…' : 'Send message'}
              </ButtonText>
            </Button>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
