import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { EditedMark } from '@/src/components/shared/edited-mark';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import { ReportSheetContent, type ReportSubmission } from '@/src/components/shared/report-sheet';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useBlockUser, useOpenProfile, useReportMember } from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';
import { ApiError } from '@/src/services/api';

import { SERVICE_CATEGORY_LABEL, serviceCategoryAccent } from './service-category';
import { ServiceComposer } from './service-composer';
import { ServiceReviewComposer } from './service-review-composer';
import { ServiceReviewItem } from './service-review-item';
import {
  useCreateServiceReview,
  useDeleteServiceReview,
  useReportServiceReview,
  useServiceReviews,
  useUpdateServiceReview,
  type ServiceReview,
} from './use-service-reviews';
import {
  useDeleteServiceListing,
  useServiceListing,
  useUpdateServiceListing,
} from './use-services';

interface ServiceDetailScreenProps {
  readonly listingId: string;
  readonly onBack: () => void;
}

const COLOR_STAR = 'rgb(217,123,41)';

function ListingMenuRow({
  destructive,
  icon,
  label,
  onPress,
}: {
  readonly destructive?: boolean;
  readonly icon: AppIconName;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const color = destructive ? 'rgb(231,0,11)' : 'rgb(37,30,23)';
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 px-1.5 py-3.5"
      onPress={onPress}
    >
      <Icon color={color} name={icon} size={20} />
      <Text
        className="text-[15px]"
        style={{ color, fontWeight: destructive ? '500' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ContactRow({
  icon,
  label,
  onPress,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-2"
      onPress={onPress}
    >
      <Icon color="rgb(120,108,94)" name={icon} size={16} />
      <Text className="text-[14px] text-accent">{label}</Text>
    </Pressable>
  );
}

export function ServiceDetailScreen({ listingId, onBack }: ServiceDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const listingQuery = useServiceListing(listingId);
  const updateListing = useUpdateServiceListing();
  const deleteListing = useDeleteServiceListing();
  const reviews = useServiceReviews(listingId);
  const createReview = useCreateServiceReview(listingId);
  const updateReview = useUpdateServiceReview(listingId);
  const deleteReview = useDeleteServiceReview(listingId);
  const reportReview = useReportServiceReview();
  const blockUser = useBlockUser();
  const reportMember = useReportMember();

  // A single Sheet whose content switches by mode, rather than separate
  // Sheet/Modal instances -- closing one and opening another in the same
  // tick briefly presents two native Modals at once (a Sheet stays mounted,
  // rendering its own full-screen Modal, until its close animation
  // finishes), which corrupts UIKit's presentation stack and can leave the
  // screen permanently unresponsive. Applies to both the listing's own
  // menu/edit/delete-confirm flow and the review actions/edit flow.
  const [sheetMode, setSheetMode] = useState<
    'menu' | 'edit' | 'confirm-delete' | null
  >(null);
  const [actionsFor, setActionsFor] = useState<ServiceReview | null>(null);
  const [reviewSheetMode, setReviewSheetMode] = useState<'actions' | 'edit' | 'report' | null>(
    null,
  );
  // Which target a reviewSheetMode of 'report' is for -- the review itself,
  // or its author.
  const [reviewReportTarget, setReviewReportTarget] = useState<'review' | 'user' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Forces the create-review composer to remount (fresh, empty state) only
  // once a submission actually succeeds — see the WHY comment in
  // ServiceReviewComposer for why clearing can't happen on submit itself.
  const [reviewComposerKey, setReviewComposerKey] = useState(0);

  const listing = listingQuery.data?.listing;
  const isOwnListing = !!listing && listing.author.id === userId;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const openReportReview = () => {
    setReviewReportTarget('review');
    setReviewSheetMode('report');
  };

  const openReportReviewAuthor = () => {
    setReviewReportTarget('user');
    setReviewSheetMode('report');
  };

  const handleReviewReportSubmit = (submission: ReportSubmission) => {
    const target = actionsFor;
    if (!target) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setReviewSheetMode(null);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (reviewReportTarget === 'user') {
      reportMember.mutate({ reportedUserId: target.author.id, ...submission }, onSettled);
      return;
    }
    reportReview.mutate({ reviewId: target.id, ...submission }, onSettled);
  };

  const handleDeleteListing = () => {
    if (!listing) {
      return;
    }
    setSheetMode(null);
    deleteListing.mutate(listing.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBack();
      },
      onError: () => showToast('Couldn’t delete this listing. Try again.'),
    });
  };

  const reviewList = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];
  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: reviews.fetchNextPage,
      hasNextPage: reviews.hasNextPage,
      isFetchingNextPage: reviews.isFetchingNextPage,
    },
  ]);

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
          Listing
        </Heading>
        <BookmarkButton size={18} targetId={listingId} targetType="service" />
        <Pressable
          accessibilityLabel="Share listing"
          accessibilityRole="button"
          onPress={() => {
            if (!listing) {
              return;
            }
            void Share.share({
              message: `${listing.businessName}\n\n${listing.description}`,
            });
          }}
        >
          <Icon color="rgb(120,108,94)" name="Share" size={18} />
        </Pressable>
        {isOwnListing && (
          <Pressable
            accessibilityLabel="More options"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSheetMode('menu')}
          >
            <Icon color="rgb(120,108,94)" name="ThreeDots" size={18} />
          </Pressable>
        )}
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-[18px] py-4"
          onScroll={onScroll}
          scrollEventThrottle={100}
        >
        {listing ? (
          <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
            {listing.media && listing.media.length > 0 && (
              <MediaGallery media={listing.media} />
            )}

            <Pressable
              accessibilityLabel={`Listed by ${listing.author.name}`}
              accessibilityRole="button"
              className="flex-row items-center gap-2"
              onPress={() => openProfile(listing.author.id, listing.author.name)}
            >
              <Avatar
                name={listing.author.name}
                size="sm"
                src={listing.author.avatarUrl ?? undefined}
              />
              <Text className="text-[13px] text-text-muted">
                Listed by{' '}
                <Text className="font-inter-semibold text-content">
                  {listing.author.name}
                </Text>
              </Text>
              <AdminBadge isAdmin={listing.author.isAdmin} />
            </Pressable>

            <HStack className="items-center gap-2">
              <Badge variant={serviceCategoryAccent(listing.category)}>
                {SERVICE_CATEGORY_LABEL[listing.category]}
              </Badge>
              {listing.averageRating !== null ? (
                <HStack className="items-center gap-1">
                  <Icon color={COLOR_STAR} fill={COLOR_STAR} name="Star" size={13} />
                  <Text className="font-inter-semibold text-[13px] text-content">
                    {listing.averageRating.toFixed(1)}
                  </Text>
                  <Text className="text-text-muted" size="xs">
                    ({listing.reviewCount})
                  </Text>
                </HStack>
              ) : (
                <Text className="text-text-muted" size="xs">
                  No reviews yet
                </Text>
              )}
            </HStack>

            <HStack className="items-center gap-1.5">
              <Heading className="font-inter-bold text-[22px]" size="lg">
                {listing.businessName}
              </Heading>
              <EditedMark editedAt={listing.editedAt} />
            </HStack>
            <Text className="text-[15px] leading-[22px] text-muted-foreground">
              {listing.description}
            </Text>

            {listing.serviceArea ? (
              <HStack className="items-center gap-1.5">
                <Icon color="rgb(120,108,94)" name="Globe" size={16} />
                <Text className="text-[14px] text-text-muted">
                  {listing.serviceArea}
                </Text>
              </HStack>
            ) : null}

            {listing.hours ? (
              <HStack className="items-center gap-1.5">
                <Icon color="rgb(120,108,94)" name="Clock" size={16} />
                <Text className="text-[14px] text-text-muted">
                  {listing.hours}
                </Text>
              </HStack>
            ) : null}

            <Divider />

            <VStack space="xs">
              {listing.contactPhone ? (
                <ContactRow
                  icon="Phone"
                  label={listing.contactPhone}
                  onPress={() => void Linking.openURL(`tel:${listing.contactPhone}`)}
                />
              ) : null}
              {listing.contactEmail ? (
                <ContactRow
                  icon="Mail"
                  label={listing.contactEmail}
                  onPress={() => void Linking.openURL(`mailto:${listing.contactEmail}`)}
                />
              ) : null}
              {listing.contactWebsite ? (
                <ContactRow
                  icon="Globe"
                  label={listing.contactWebsite}
                  onPress={() => void Linking.openURL(listing.contactWebsite ?? '')}
                />
              ) : null}
            </VStack>
          </VStack>
        ) : listingQuery.isPending ? (
          <View className="items-center py-10">
            <Spinner size="xlarge" />
          </View>
        ) : (
          <Text className="text-text-muted" size="sm">
            This listing is no longer available.
          </Text>
        )}

        <Divider />
        <Text className="font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
          {reviewList.length} reviews
        </Text>

        {reviews.isPending ? (
          <View className="items-center py-10">
            <Spinner size="xlarge" />
          </View>
        ) : reviews.isError ? (
          <VStack className="items-start gap-2 py-2" testID="service-reviews-error">
            <Text className="text-text-muted" size="sm">
              Couldn&apos;t load reviews.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-full border border-line px-3 py-2"
              onPress={() => void reviews.refetch()}
              testID="service-reviews-retry"
            >
              <Text className="font-inter-semibold text-content" size="xs">
                Retry
              </Text>
            </Pressable>
          </VStack>
        ) : reviewList.length === 0 ? (
          <Text className="py-2 text-text-muted" size="sm">
            No reviews yet — be the first to share how it went.
          </Text>
        ) : (
          <VStack className="gap-4">
            {reviewList.map((review) => (
              <ServiceReviewItem
                key={review.id}
                onActions={(review) => {
                  setActionsFor(review);
                  setReviewSheetMode('actions');
                }}
                onOpenAuthor={openProfile}
                review={review}
              />
            ))}
            {reviews.hasNextPage ? (
              reviews.isFetchingNextPage ? (
                <View className="items-center py-3" testID="service-reviews-load-more">
                  <Spinner size="small" />
                </View>
              ) : null
            ) : (
              <AllCaughtUp />
            )}
          </VStack>
        )}
        </ScrollView>

        {/* Pinned footer, not part of the scroll -- KeyboardAvoidingView only
            resizes its flex-1 sibling above, it doesn't scroll to a focused
            field, so a review composer embedded mid-scroll never came into
            view on its own when the keyboard opened. */}
        <View className="border-t border-line px-[18px] py-3">
          <ServiceReviewComposer
            isSubmitting={createReview.isPending}
            key={reviewComposerKey}
            onSubmit={(input) =>
              createReview.mutate(input, {
                onSuccess: () => {
                  setReviewComposerKey((key) => key + 1);
                  void Haptics.selectionAsync();
                },
                onError: (error) =>
                  showToast(
                    error instanceof ApiError
                      ? error.message
                      : 'Couldn’t post your review. Try again.',
                  ),
              })
            }
          />
        </View>
      </KeyboardAvoidingView>

      {/* Own-listing options menu / edit -- one Sheet, content switches by mode */}
      <Sheet onClose={() => setSheetMode(null)} visible={sheetMode !== null}>
        {sheetMode === 'edit' && listing ? (
          <ServiceComposer
            initialBusinessName={listing.businessName}
            initialCategory={listing.category}
            initialContactEmail={listing.contactEmail ?? ''}
            initialContactPhone={listing.contactPhone ?? ''}
            initialContactWebsite={listing.contactWebsite ?? ''}
            initialDescription={listing.description}
            initialHours={listing.hours ?? ''}
            initialLogo={listing.logo ?? null}
            initialMedia={listing.media}
            initialServiceArea={listing.serviceArea ?? ''}
            isSubmitting={updateListing.isPending}
            onDismiss={() => setSheetMode(null)}
            onSubmit={(draft) =>
              updateListing.mutate(
                { listingId: listing.id, ...draft },
                {
                  onSuccess: () => {
                    setSheetMode(null);
                    void Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  },
                  onError: () =>
                    showToast("Couldn't save your changes. Try again."),
                },
              )
            }
            submitLabel="Save"
          />
        ) : sheetMode === 'confirm-delete' ? (
          <View className="gap-1 px-[18px] pb-4 pt-1">
            <Text className="font-inter-bold text-[17px] text-content">
              Delete this listing?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone. All of its reviews will be removed too.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setSheetMode(null)}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={handleDeleteListing}>
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            <ListingMenuRow
              icon="Edit"
              label="Edit listing"
              onPress={() => setSheetMode('edit')}
            />
            <Divider />
            <ListingMenuRow
              destructive
              icon="AlertCircle"
              label="Delete listing"
              onPress={() => setSheetMode('confirm-delete')}
            />
          </View>
        )}
      </Sheet>

      {/* Review actions / edit -- one Sheet, content switches by mode */}
      <Sheet
        onClose={() => setReviewSheetMode(null)}
        visible={reviewSheetMode !== null}
      >
        {reviewSheetMode === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              reviewReportTarget === 'user' ? reportMember.isPending : reportReview.isPending
            }
            onSubmit={handleReviewReportSubmit}
            title={
              reviewReportTarget === 'user' && actionsFor
                ? `Report ${actionsFor.author.name}`
                : 'Report review'
            }
          />
        ) : reviewSheetMode === 'edit' && actionsFor ? (
          <View className="px-[18px] pb-2">
            <ServiceReviewComposer
              initialBody={actionsFor.body}
              initialRating={actionsFor.rating}
              isSubmitting={updateReview.isPending}
              onCancel={() => setReviewSheetMode(null)}
              onSubmit={(input) =>
                updateReview.mutate(
                  { reviewId: actionsFor.id, ...input },
                  {
                    onError: () =>
                      showToast("Couldn't save your changes. Try again."),
                    onSuccess: () => {
                      setReviewSheetMode(null);
                      void Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                    },
                  },
                )
              }
              submitLabel="Save"
              title="Edit review"
            />
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {actionsFor && actionsFor.author.id === userId ? (
              <>
                <ListingMenuRow
                  icon="Edit"
                  label="Edit review"
                  onPress={() => setReviewSheetMode('edit')}
                />
                <Divider />
                <ListingMenuRow
                  destructive
                  icon="AlertCircle"
                  label="Delete review"
                  onPress={() => {
                    const target = actionsFor;
                    setReviewSheetMode(null);
                    deleteReview.mutate(target.id, {
                      onError: () =>
                        showToast('Couldn’t delete this review. Try again.'),
                    });
                  }}
                />
              </>
            ) : (
              <>
                <ListingMenuRow
                  icon="EyeOff"
                  label="Block this neighbour"
                  onPress={() => {
                    const target = actionsFor;
                    setReviewSheetMode(null);
                    if (!target) return;
                    blockUser.mutate(target.author.id, {
                      onError: () =>
                        showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () => showToast(`Blocked ${target.author.name}`),
                    });
                  }}
                />
                <Divider />
                <ListingMenuRow
                  destructive
                  icon="Flag"
                  label="Report this user"
                  onPress={openReportReviewAuthor}
                />
                <Divider />
                <ListingMenuRow
                  destructive
                  icon="AlertCircle"
                  label="Report review"
                  onPress={openReportReview}
                />
              </>
            )}
          </View>
        )}
      </Sheet>

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 96 }}
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
