import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { EditedMark } from '@/src/components/shared/edited-mark';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import {
  ReportSheetContent,
  type ReportSubmission,
} from '@/src/components/shared/report-sheet';
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
import {
  useBlockUser,
  useOpenProfile,
  useReportMember,
} from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

import { BUSINESS_CATEGORY_LABEL, businessCategoryAccent } from './business-category';
import { BusinessComposer } from './business-composer';
import {
  useBusinessListing,
  useDeleteBusinessListing,
  useReportBusinessListing,
  useUpdateBusinessListing,
} from './use-businesses';

interface BusinessDetailScreenProps {
  readonly listingId: string;
  readonly onBack: () => void;
  // True when reached from Notifications (see
  // app/notification/business/[id].tsx), presented as a formSheet -- see
  // EventDetailScreen's identical prop for the full WHY.
  readonly modal?: boolean;
}

const COLOR_VERIFIED = 'rgb(74,124,89)';

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

export function BusinessDetailScreen({
  listingId,
  modal = false,
  onBack,
}: BusinessDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const listingQuery = useBusinessListing(listingId);
  const updateListing = useUpdateBusinessListing();
  const deleteListing = useDeleteBusinessListing();
  const reportListing = useReportBusinessListing();
  const blockUser = useBlockUser();
  const reportMember = useReportMember();

  // A single Sheet whose content switches by mode -- see
  // ServiceDetailScreen's matching comment for why one Sheet instance is
  // required rather than several.
  const [sheetMode, setSheetMode] = useState<
    'menu' | 'edit' | 'confirm-delete' | 'report' | null
  >(null);
  const [reportTarget, setReportTarget] = useState<'listing' | 'user' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const listing = listingQuery.data?.listing;
  const isOwnListing = !!listing && listing.author.id === userId;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const openReportListing = () => {
    setReportTarget('listing');
    setSheetMode('report');
  };

  const openReportAuthor = () => {
    setReportTarget('user');
    setSheetMode('report');
  };

  const handleReportSubmit = (submission: ReportSubmission) => {
    if (!listing) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setSheetMode(null);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (reportTarget === 'user') {
      reportMember.mutate(
        { reportedUserId: listing.author.id, ...submission },
        onSettled,
      );
      return;
    }
    reportListing.mutate({ listingId, ...submission }, onSettled);
  };

  const handleDeleteListing = () => {
    if (!listing) {
      return;
    }
    setSheetMode(null);
    deleteListing.mutate(listing.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        onBack();
      },
      onError: () => showToast('Couldn’t delete this listing. Try again.'),
    });
  };

  return (
    <View
      className={modal ? 'bg-canvas' : 'flex-1 bg-canvas'}
      collapsable={false}
      style={modal ? { height: '100%' } : undefined}
    >
      <HStack
        className={`items-center gap-2 px-[18px] pb-3 ${modal ? '' : 'border-b border-line'}`}
        collapsable={false}
        style={{ paddingTop: modal ? 32 : insets.top + 8 }}
      >
        {modal ? null : (
          <Pressable accessibilityLabel="Back" onPress={onBack}>
            <Icon name="ChevronLeft" size={22} />
          </Pressable>
        )}
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Listing
        </Heading>
        <BookmarkButton size={18} targetId={listingId} targetType="business" />
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
        <Pressable
          accessibilityLabel="More options"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSheetMode('menu')}
        >
          <Icon color="rgb(120,108,94)" name="ThreeDots" size={18} />
        </Pressable>
      </HStack>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void listingQuery.refetch()}
            refreshing={listingQuery.isRefetching}
          />
        }
      >
        <VStack className="gap-4 px-[18px] pt-4">
          {listing ? (
            <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
              {listing.media && listing.media.length > 0 && (
                <MediaGallery media={listing.media} />
              )}

              <Pressable
                accessibilityLabel={`Listed by ${listing.author.name}`}
                accessibilityRole="button"
                className="flex-row items-center gap-2"
                onPress={() =>
                  openProfile(listing.author.id, listing.author.name)
                }
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
                <Badge variant={businessCategoryAccent(listing.category)}>
                  {BUSINESS_CATEGORY_LABEL[listing.category]}
                </Badge>
                {listing.verificationStatus === 'verified' ? (
                  <HStack className="items-center gap-1">
                    <Icon color={COLOR_VERIFIED} name="CheckCircle" size={13} />
                    <Text
                      className="font-inter-semibold text-[12px]"
                      style={{ color: COLOR_VERIFIED }}
                    >
                      Verified
                    </Text>
                  </HStack>
                ) : isOwnListing ? (
                  <Badge variant="muted">Pending review</Badge>
                ) : null}
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

              {listing.currentSpecial ? (
                <VStack
                  className="gap-1 rounded-[14px] bg-[rgb(250,235,225)] p-3.5"
                  space="xs"
                >
                  <HStack className="items-center gap-1.5">
                    <Icon color="rgb(181,80,44)" name="Sparkles" size={14} />
                    <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-[rgb(181,80,44)]">
                      Current special
                    </Text>
                  </HStack>
                  <Text className="text-[14px] leading-5 text-content">
                    {listing.currentSpecial}
                  </Text>
                </VStack>
              ) : null}

              {listing.address ? (
                <HStack className="items-center gap-1.5">
                  <Icon color="rgb(120,108,94)" name="Globe" size={16} />
                  <Text className="text-[14px] text-text-muted">
                    {listing.address}
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
                    onPress={() =>
                      void Linking.openURL(`tel:${listing.contactPhone}`)
                    }
                  />
                ) : null}
                {listing.contactEmail ? (
                  <ContactRow
                    icon="Mail"
                    label={listing.contactEmail}
                    onPress={() =>
                      void Linking.openURL(`mailto:${listing.contactEmail}`)
                    }
                  />
                ) : null}
                {listing.contactWebsite ? (
                  <ContactRow
                    icon="Globe"
                    label={listing.contactWebsite}
                    onPress={() =>
                      void Linking.openURL(listing.contactWebsite ?? '')
                    }
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
        </VStack>
      </ScrollView>

      {/* Listing options menu / edit / report -- one Sheet, content switches
          by mode (see ServiceDetailScreen's identical pattern). */}
      <Sheet onClose={() => setSheetMode(null)} visible={sheetMode !== null}>
        {(maxContentHeight) =>
          sheetMode === 'edit' && listing ? (
            <BusinessComposer
              initialAddress={listing.address ?? ''}
              initialBusinessName={listing.businessName}
              initialCategory={listing.category}
              initialContactEmail={listing.contactEmail ?? ''}
              initialContactPhone={listing.contactPhone ?? ''}
              initialContactWebsite={listing.contactWebsite ?? ''}
              initialCurrentSpecial={listing.currentSpecial ?? ''}
              initialDescription={listing.description}
              initialHours={listing.hours ?? ''}
              initialLogo={listing.logo ?? null}
              initialMedia={listing.media}
              isSubmitting={updateListing.isPending}
              maxContentHeight={maxContentHeight}
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
                This can’t be undone.
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
          ) : sheetMode === 'report' ? (
            <ReportSheetContent
              isSubmitting={
                reportTarget === 'user'
                  ? reportMember.isPending
                  : reportListing.isPending
              }
              maxContentHeight={maxContentHeight}
              onSubmit={handleReportSubmit}
              title={
                reportTarget === 'user' && listing
                  ? `Report ${listing.author.name}`
                  : 'Report listing'
              }
            />
          ) : (
            <View className="gap-1 px-[18px] pb-2">
              {isOwnListing ? (
                <>
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
                </>
              ) : (
                <>
                  <ListingMenuRow
                    icon="EyeOff"
                    label="Block this neighbour"
                    onPress={() => {
                      if (!listing) return;
                      setSheetMode(null);
                      blockUser.mutate(listing.author.id, {
                        onError: () =>
                          showToast('Couldn’t block this neighbour. Try again.'),
                        onSuccess: () =>
                          showToast(`Blocked ${listing.author.name}`),
                      });
                    }}
                  />
                  <Divider />
                  <ListingMenuRow
                    destructive
                    icon="Flag"
                    label="Report this user"
                    onPress={openReportAuthor}
                  />
                  <Divider />
                  <ListingMenuRow
                    destructive
                    icon="AlertCircle"
                    label="Report listing"
                    onPress={openReportListing}
                  />
                </>
              )}
            </View>
          )
        }
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
