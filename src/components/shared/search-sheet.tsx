import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

interface SearchSheetProps<T> {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly items: readonly T[];
  readonly getKey: (item: T) => string;
  readonly getTitle: (item: T) => string;
  readonly getSubtitle?: (item: T) => string;
  readonly onSelect: (item: T) => void;
  readonly placeholder: string;
}

// A generic, reusable "search this screen's list" sheet — Forum, Events, and
// Missions each have their own list of items already loaded client-side, so
// rather than building a separate search backend this just filters the list
// the screen already has by title.
export function SearchSheet<T>({
  visible,
  onClose,
  items,
  getKey,
  getTitle,
  getSubtitle,
  onSelect,
  placeholder,
}: SearchSheetProps<T>) {
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
    <Sheet onClose={handleClose} visible={visible}>
      <VStack className="gap-3 px-[18px] pb-6" space="sm">
        <View className="h-11 flex-row items-center gap-2 rounded-full border border-content px-4">
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
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
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
      </VStack>
    </Sheet>
  );
}
