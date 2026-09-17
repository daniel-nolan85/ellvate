import { useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaViewer } from '@/src/components/shared/media-gallery';
import {
  ReportSheetContent,
  type ReportSubmission,
} from '@/src/components/shared/report-sheet';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import {
  useMissionCheckInPhotos,
  useReportMissionCheckInPhoto,
  type MissionCheckInPhoto,
} from './use-mission-check-in-photos';

const THUMB_SIZE = 64;
const THUMB_GAP = 8;
// The most tiles (thumbnails + the "View all" tile, if shown) that fit in
// one row without wrapping, on the narrowest width this app supports
// (iPhone SE, 375pt). This row sits inside mission-detail-screen's
// px-[18px] screen padding plus its card's own p-[18px] padding -- 72pt of
// horizontal inset total, leaving 303pt. At THUMB_SIZE=64 and an 8pt gap
// between tiles, n*64 + (n-1)*8 <= 303 solves to n <= 4.3, so 4 is the most
// that ever fits on one row across every supported device width.
const PREVIEW_MAX = 4;

const toViewerItems = (photos: readonly MissionCheckInPhoto[]) =>
  photos.map((photo) => ({ filename: photo.id, url: photo.photoUrl }));

// A bounded preview -- just the first loaded page, no fetch-more here.
// "View all" is the paginated, unbounded surface (MissionCheckInGalleryScreen).
export function MissionCheckInThumbnailRow({
  missionId,
  onOpenAll,
}: {
  readonly missionId: string;
  readonly onOpenAll: () => void;
}) {
  const gallery = useMissionCheckInPhotos(missionId);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photos = gallery.data?.pages[0]?.photos ?? [];
  if (photos.length === 0) {
    return null;
  }

  const hasMore = gallery.hasNextPage || photos.length > PREVIEW_MAX;
  // Reserve one slot for the "View all" tile whenever there's more than
  // fits here, so the total tile count (thumbnails + that tile) never
  // exceeds PREVIEW_MAX -- see its own WHY for the row-width math this
  // keeps this row within.
  const preview = photos.slice(0, hasMore ? PREVIEW_MAX - 1 : PREVIEW_MAX);

  return (
    <VStack className="gap-2">
      {/* No horizontal padding here -- unlike the full-bleed gallery screen
          below, this row only ever renders inside mission-detail-screen's
          own padded card, which already insets it correctly. */}
      <HStack className="items-center justify-between">
        <Text className="font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
          Mission photos
        </Text>
        <Pressable accessibilityRole="button" onPress={onOpenAll}>
          <Text className="font-inter-semibold text-[12px] text-accent">
            View all
          </Text>
        </Pressable>
      </HStack>
      <HStack className="flex-wrap gap-2">
        {preview.map((photo, index) => (
          <Pressable
            accessibilityLabel="View check-in photo"
            accessibilityRole="button"
            key={photo.id}
            onPress={() => setViewerIndex(index)}
          >
            <Image
              className="rounded-lg bg-secondary"
              source={{ uri: photo.photoUrl }}
              style={{ height: THUMB_SIZE, width: THUMB_SIZE }}
            />
          </Pressable>
        ))}
        {hasMore ? (
          <Pressable
            accessibilityLabel="View all check-in photos"
            accessibilityRole="button"
            className="items-center justify-center rounded-lg bg-secondary"
            onPress={onOpenAll}
            style={{ height: THUMB_SIZE, width: THUMB_SIZE }}
          >
            <Text className="font-inter-semibold text-[12px] text-secondary-foreground">
              View all
            </Text>
          </Pressable>
        ) : null}
      </HStack>
      {viewerIndex !== null ? (
        <MediaViewer
          media={toViewerItems(preview)}
          onClose={() => setViewerIndex(null)}
          startIndex={viewerIndex}
        />
      ) : null}
    </VStack>
  );
}

interface MissionCheckInGalleryScreenProps {
  readonly missionId: string;
  readonly onBack: () => void;
}

// The unbounded, paginated counterpart to MissionCheckInThumbnailRow -- a
// full screen (not a Sheet) because it needs its own tap-to-expand lightbox
// Modal, and stacking two RN Modals at once (a Sheet's own Modal plus the
// lightbox's) corrupts UIKit's presentation stack -- see
// mission-detail-screen.tsx's identical WHY for its own Sheet/Modal split.
export function MissionCheckInGalleryScreen({
  missionId,
  onBack,
}: MissionCheckInGalleryScreenProps) {
  const insets = useSafeAreaInsets();
  const gallery = useMissionCheckInPhotos(missionId);
  const reportPhoto = useReportMissionCheckInPhoto();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<MissionCheckInPhoto | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const photos = gallery.data?.pages.flatMap((page) => page.photos) ?? [];

  const handleReportSubmit = (submission: ReportSubmission) => {
    if (!reportTarget) {
      return;
    }
    reportPhoto.mutate(
      { checkInId: reportTarget.id, ...submission },
      {
        onError: () => showToast('Couldn’t submit your report. Try again.'),
        onSuccess: () => {
          setReportTarget(null);
          showToast('Thanks — our moderators will take a look.');
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center gap-2 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityLabel="Back" onPress={onBack}>
          <Icon name="ChevronLeft" size={22} />
        </Pressable>
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Mission photos
        </Heading>
      </HStack>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={gallery.isPending || gallery.isError ? [] : photos}
        keyExtractor={(photo) => photo.id}
        ListEmptyComponent={
          gallery.isPending ? (
            <VStack className="items-center justify-center py-24">
              <Spinner size="xlarge" />
            </VStack>
          ) : (
            <Text className="px-1 py-4 text-center text-muted-foreground" size="sm">
              {gallery.isError
                ? "Couldn't load mission photos."
                : 'No mission photos yet.'}
            </Text>
          )
        }
        numColumns={3}
        onEndReached={() => {
          if (gallery.hasNextPage && !gallery.isFetchingNextPage) {
            void gallery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => (
          <View style={{ padding: THUMB_GAP / 2, width: '33.333%' }}>
            <Pressable
              accessibilityLabel={`Check-in photo by ${item.author.name}`}
              accessibilityRole="button"
              onPress={() => setViewerIndex(index)}
            >
              <Image
                className="aspect-square rounded-lg bg-secondary"
                source={{ uri: item.photoUrl }}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Report this photo"
              accessibilityRole="button"
              className="absolute right-2.5 top-2.5 rounded-full bg-[rgba(0,0,0,0.45)] p-1"
              hitSlop={8}
              onPress={() => setReportTarget(item)}
            >
              <Icon color="rgb(255,255,255)" name="Flag" size={12} />
            </Pressable>
          </View>
        )}
      />

      {viewerIndex !== null ? (
        <MediaViewer
          media={toViewerItems(photos)}
          onClose={() => setViewerIndex(null)}
          startIndex={viewerIndex}
        />
      ) : null}

      <Sheet onClose={() => setReportTarget(null)} visible={reportTarget !== null}>
        {(maxContentHeight) => (
          <ReportSheetContent
            isSubmitting={reportPhoto.isPending}
            maxContentHeight={maxContentHeight}
            onSubmit={handleReportSubmit}
            title="Report photo"
          />
        )}
      </Sheet>

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Icon color="rgb(250,250,250)" name="CheckCircle" size={16} />
          <Text className="flex-1 text-[14px] text-primary-foreground">
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
