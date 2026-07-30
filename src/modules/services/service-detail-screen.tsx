import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { MediaGallery } from '@/src/components/shared/media-gallery';
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
import { useMuteUser } from '@/src/modules/forum';
import { useSession } from '@/src/platform/session';

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
  useServicesView,
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

  const servicesView = useServicesView();
  const updateListing = useUpdateServiceListing();
  const deleteListing = useDeleteServiceListing();
  const reviews = useServiceReviews(listingId);
  const createReview = useCreateServiceReview(listingId);
  const updateReview = useUpdateServiceReview(listingId);
  const deleteReview = useDeleteServiceReview(listingId);
  const reportReview = useReportServiceReview();
  const muteUser = useMuteUser();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<ServiceReview | null>(null);
  const [editingReview, setEditingReview] = useState<ServiceReview | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const listing = useMemo(
    () => servicesView.data?.listings.find((entry) => entry.id === listingId),
    [servicesView.data, listingId],
  );
  const isOwnListing = !!listing && listing.author.id === userId;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleDeleteListing = () => {
    if (!listing) {
      return;
    }
    setConfirmDeleteOpen(false);
    deleteListing.mutate(listing.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBack();
      },
      onError: () => showToast('Couldn’t delete this listing. Try again.'),
    });
  };

  const reviewList = reviews.data ?? [];

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
            onPress={() => setMenuOpen(true)}
          >
            <Icon color="rgb(120,108,94)" name="ThreeDots" size={18} />
          </Pressable>
        )}
      </HStack>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-[18px] py-4">
        {listing ? (
          <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
            {listing.media && listing.media.length > 0 && (
              <MediaGallery media={listing.media} />
            )}

            <HStack className="items-center gap-2">
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
            </HStack>

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

            <Heading className="font-inter-bold text-[22px]" size="lg">
              {listing.businessName}
            </Heading>
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
        ) : servicesView.isPending ? (
          <View className="items-center py-10">
            <Spinner />
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

        <ServiceReviewComposer
          isSubmitting={createReview.isPending}
          onSubmit={(input) =>
            createReview.mutate(input, {
              onSuccess: () => void Haptics.selectionAsync(),
              onError: () => showToast('Couldn’t post your review. Try again.'),
            })
          }
        />

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
                onActions={setActionsFor}
                review={review}
              />
            ))}
          </VStack>
        )}
      </ScrollView>

      {/* Own-listing options menu */}
      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className="gap-1 px-[18px] pb-2">
          <ListingMenuRow
            icon="Edit"
            label="Edit listing"
            onPress={() => {
              setMenuOpen(false);
              setIsEditing(true);
            }}
          />
          <Divider />
          <ListingMenuRow
            destructive
            icon="AlertCircle"
            label="Delete listing"
            onPress={() => {
              setMenuOpen(false);
              setConfirmDeleteOpen(true);
            }}
          />
        </View>
      </Sheet>

      {/* Delete confirmation */}
      <Modal
        animationType="fade"
        onRequestClose={() => setConfirmDeleteOpen(false)}
        transparent
        visible={confirmDeleteOpen}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8"
          onPress={() => setConfirmDeleteOpen(false)}
        >
          <Pressable
            className="w-full gap-1 rounded-[20px] bg-paper p-5"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="font-inter-bold text-[17px] text-content">
              Delete this listing?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone. All of its reviews will be removed too.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setConfirmDeleteOpen(false)}>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit listing sheet */}
      {listing && (
        <Sheet onClose={() => setIsEditing(false)} visible={isEditing}>
          <ServiceComposer
            initialBusinessName={listing.businessName}
            initialCategory={listing.category}
            initialContactEmail={listing.contactEmail ?? ''}
            initialContactPhone={listing.contactPhone ?? ''}
            initialContactWebsite={listing.contactWebsite ?? ''}
            initialDescription={listing.description}
            initialLogo={listing.logo ?? null}
            initialMedia={listing.media}
            initialServiceArea={listing.serviceArea ?? ''}
            isSubmitting={updateListing.isPending}
            onDismiss={() => setIsEditing(false)}
            onSubmit={(draft) =>
              updateListing.mutate(
                { listingId: listing.id, ...draft },
                {
                  onSuccess: () => {
                    setIsEditing(false);
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
        </Sheet>
      )}

      {/* Review actions */}
      <Sheet onClose={() => setActionsFor(null)} visible={actionsFor !== null}>
        <View className="gap-1 px-[18px] pb-2">
          {actionsFor && actionsFor.author.id === userId ? (
            <>
              <ListingMenuRow
                icon="Edit"
                label="Edit review"
                onPress={() => {
                  const target = actionsFor;
                  setActionsFor(null);
                  setEditingReview(target);
                }}
              />
              <Divider />
              <ListingMenuRow
                destructive
                icon="AlertCircle"
                label="Delete review"
                onPress={() => {
                  const target = actionsFor;
                  setActionsFor(null);
                  deleteReview.mutate(target.id);
                }}
              />
            </>
          ) : (
            <>
              <ListingMenuRow
                icon="EyeOff"
                label="Mute this neighbour"
                onPress={() => {
                  const target = actionsFor;
                  setActionsFor(null);
                  if (!target) return;
                  muteUser.mutate(target.author.id, {
                    onError: () =>
                      showToast('Couldn’t mute this neighbour. Try again.'),
                    onSuccess: () => showToast(`Muted ${target.author.name}`),
                  });
                }}
              />
              <Divider />
              <ListingMenuRow
                destructive
                icon="AlertCircle"
                label="Report review"
                onPress={() => {
                  const target = actionsFor;
                  setActionsFor(null);
                  if (!target) return;
                  reportReview.mutate(target.id, {
                    onError: () =>
                      showToast('Couldn’t report this review. Try again.'),
                    onSuccess: () =>
                      showToast('Thanks — our moderators will take a look.'),
                  });
                }}
              />
            </>
          )}
        </View>
      </Sheet>

      {/* Edit review sheet */}
      <Sheet onClose={() => setEditingReview(null)} visible={editingReview !== null}>
        <View className="px-[18px] pb-2">
          {editingReview ? (
            <ServiceReviewComposer
              initialBody={editingReview.body}
              initialRating={editingReview.rating}
              isSubmitting={updateReview.isPending}
              onCancel={() => setEditingReview(null)}
              onSubmit={(input) =>
                updateReview.mutate(
                  { reviewId: editingReview.id, ...input },
                  {
                    onError: () =>
                      showToast("Couldn't save your changes. Try again."),
                    onSuccess: () => {
                      setEditingReview(null);
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
          ) : null}
        </View>
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
