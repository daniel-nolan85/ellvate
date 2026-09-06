import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

interface ScopedSearchScreenProps<T> {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly items: readonly T[];
  readonly getKey: (item: T) => string;
  readonly getTitle: (item: T) => string;
  readonly getSubtitle?: (item: T) => string;
  readonly onSelect: (item: T) => void;
  readonly placeholder: string;
}

// A generic, reusable "search this screen's own list" full screen --
// Activity, Bookmarks, Leaderboard, and Blocked Users each have their own
// list of items already loaded client-side, so rather than building a
// separate search backend this just filters the list the screen already
// has by title. A full screen, matching this app's one search interaction
// pattern everywhere (see src/modules/search/search-screen.tsx, the
// app-wide equivalent this mirrors the chrome of) rather than the small
// bottom sheet this used to be. The placeholder text is what tells the
// user this only searches this screen's own list, not the whole community
// -- the same way the app-wide search's own "Search the community"
// placeholder makes its (wider) scope clear.
export function ScopedSearchScreen<T>({
  visible,
  onClose,
  items,
  getKey,
  getTitle,
  getSubtitle,
  onSelect,
  placeholder,
}: ScopedSearchScreenProps<T>) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return items;
    }
    return items.filter((item) => getTitle(item).toLowerCase().includes(trimmed));
  }, [items, query, getTitle]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <View className="flex-1 bg-canvas">
        <HStack
          className="items-center gap-2 border-b border-line px-[18px] pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="h-11 flex-1 flex-row items-center gap-2 rounded-full border border-content px-4">
            <Icon color="rgb(120,108,94)" name="Search" size={18} />
            <TextInput
              autoFocus
              className="h-full flex-1 text-[15px] text-content"
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor="rgb(169,156,139)"
              value={query}
            />
            {query.length > 0 ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                <Icon color="rgb(120,108,94)" name="Close" size={16} />
              </Pressable>
            ) : null}
          </View>
          <Pressable accessibilityLabel="Close search" onPress={handleClose}>
            <Text className="font-inter-semibold text-[14px] text-accent">Cancel</Text>
          </Pressable>
        </HStack>

        <ScrollView
          contentContainerClassName="px-[18px] pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom) }}
          keyboardShouldPersistTaps="handled"
        >
          <VStack space="xs">
            {results.length === 0 ? (
              <Text className="px-1 py-6 text-center text-text-muted" size="sm">
                {query.trim().length > 0
                  ? `No matches for "${query.trim()}".`
                  : 'Nothing here yet.'}
              </Text>
            ) : (
              results.map((item) => (
                <Pressable
                  className="gap-0.5 rounded-[14px] px-3 py-2.5"
                  key={getKey(item)}
                  onPress={() => {
                    onSelect(item);
                    handleClose();
                  }}
                >
                  <Text className="font-inter-semibold text-content" size="sm">
                    {getTitle(item)}
                  </Text>
                  {getSubtitle ? (
                    <Text className="text-text-muted" size="xs">
                      {getSubtitle(item)}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </VStack>
        </ScrollView>
      </View>
    </Modal>
  );
}
