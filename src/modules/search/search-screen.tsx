import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar } from '@/src/modules/community-shell';
import { ProfileAvatarButton } from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

// Community-wide search across posts/events/missions/services/petitions --
// unlike ScopedSearchScreen (filters a list the screen already has
// client-side), this queries the backend directly, so it can find things
// regardless of which tab the user happens to be on.

interface SearchResultItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
}

interface GlobalSearchResults {
  readonly posts: readonly SearchResultItem[];
  readonly events: readonly SearchResultItem[];
  readonly missions: readonly SearchResultItem[];
  readonly services: readonly SearchResultItem[];
  readonly petitions: readonly SearchResultItem[];
}

// Mirrors MIN_SEARCH_QUERY_LENGTH in src/backend/search/types.ts -- kept as
// its own client-side constant (matching how every other query hook in this
// app treats its backend as a wire contract rather than an importable
// module) so this screen doesn't call the endpoint for a query too short to
// return anything anyway.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const EMPTY_RESULTS: GlobalSearchResults = {
  events: [],
  missions: [],
  petitions: [],
  posts: [],
  services: [],
};

const GROUPS: readonly {
  readonly key: keyof GlobalSearchResults;
  readonly label: string;
  readonly href: (id: string) => Href;
}[] = [
  { href: (id) => `/post/${id}` as Href, key: 'posts', label: 'Posts' },
  { href: (id) => `/event/${id}` as Href, key: 'events', label: 'Events' },
  { href: (id) => `/mission/${id}` as Href, key: 'missions', label: 'Missions' },
  { href: (id) => `/service/${id}` as Href, key: 'services', label: 'Services' },
  { href: (id) => `/petition/${id}` as Href, key: 'petitions', label: 'Petitions' },
];

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isQueryLongEnough = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const results = useQuery({
    enabled: isQueryLongEnough,
    queryFn: ({ signal }) =>
      requestJson<GlobalSearchResults>({
        getAccessToken: session.getToken,
        path: `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
        signal,
      }),
    queryKey: ['search', 'global', session.userId ?? 'demo-user', debouncedQuery],
  });

  const handleSelect = (groupIndex: number, item: SearchResultItem) => {
    router.back();
    router.push(GROUPS[groupIndex].href(item.id));
  };

  const data = results.data ?? EMPTY_RESULTS;
  const totalResults = GROUPS.reduce((sum, group) => sum + data[group.key].length, 0);

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center gap-2 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        {/* This screen is a summoned overlay with no CommunityNavBar tab of
            its own -- "Cancel" below gets back to wherever it was opened
            from, but with no way to Profile directly, matching
            notifications-screen.tsx's identical gap. */}
        <ProfileAvatarButton />
        <View className="h-11 flex-1 flex-row items-center gap-2 rounded-full border border-content px-4">
          <Icon color="rgb(120,108,94)" name="Search" size={18} />
          <TextInput
            autoFocus
            className="h-full flex-1 text-[15px] text-content"
            onChangeText={setQuery}
            placeholder="Search the community"
            placeholderTextColor="rgb(169,156,139)"
            value={query}
          />
          {query.length > 0 ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
              <Icon color="rgb(120,108,94)" name="Close" size={16} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityLabel="Close search" onPress={() => router.back()}>
          <Text className="font-inter-semibold text-[14px] text-accent">Cancel</Text>
        </Pressable>
      </HStack>

      <ScrollView
        contentContainerClassName="px-[18px] pt-4"
        contentContainerStyle={{ paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="md">
          {!isQueryLongEnough ? (
            <Text className="px-1 py-6 text-center text-text-muted" size="sm">
              Keep typing to search posts, events, missions, services, and petitions.
            </Text>
          ) : results.isPending ? (
            <View className="items-center py-6">
              <Spinner size="small" />
            </View>
          ) : totalResults === 0 ? (
            <Text className="px-1 py-6 text-center text-text-muted" size="sm">
              No matches for &quot;{debouncedQuery}&quot;.
            </Text>
          ) : (
            GROUPS.map((group, groupIndex) => {
              const items = data[group.key];
              if (items.length === 0) {
                return null;
              }
              return (
                <VStack key={group.key} space="xs">
                  <Text className="px-1 font-inter-bold text-[11px] uppercase tracking-[1px] text-text-muted">
                    {group.label}
                  </Text>
                  {items.map((item) => (
                    <Pressable
                      className="gap-0.5 rounded-[14px] px-3 py-2.5"
                      key={item.id}
                      onPress={() => handleSelect(groupIndex, item)}
                    >
                      <Text className="font-inter-semibold text-content" numberOfLines={1} size="sm">
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text className="text-text-muted" numberOfLines={1} size="xs">
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </VStack>
              );
            })
          )}
        </VStack>
      </ScrollView>

      <CommunityNavBar />
    </View>
  );
}
