import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  type ReportReason,
} from '@/src/lib/report-reasons';
import { pickGalleryImages, type PickedImage } from '@/src/platform/media-picker';

// Shared by every "report" flow in the app (post, comment, event, mission,
// service, review, check-in, petition, member) so a reason, optional
// details, and an optional evidence screenshot always reach admin, instead
// of a bare "someone reported this" with nothing to act on.

export interface ReportSubmission {
  readonly reason: ReportReason;
  readonly details?: string;
  readonly evidenceImageDataUrl?: string;
}

interface ReportSheetContentProps {
  // e.g. "Report post", "Report this member" -- names what's being reported,
  // not the action itself (the submit button already says "Submit report").
  readonly title: string;
  readonly onSubmit: (submission: ReportSubmission) => void;
  readonly isSubmitting: boolean;
}

// The form alone, no Sheet wrapper -- for a screen that already manages a
// single, mode-switching Sheet of its own (post cards, comment menus, ...).
// Mounting a second independent Sheet (each its own full-screen native
// Modal) while the first is still closing briefly presents both Modals at
// once, which corrupts UIKit's presentation stack and can leave the
// underlying card permanently unresponsive -- these screens' own comments
// document hitting exactly that. Embed this content inside that existing
// Sheet's own mode-switch instead of introducing a second Sheet. Matches
// PostComposer's own plain (non-scroll-bounded) ScrollView root, which
// already works embedded the same way in post-card.tsx.
export function ReportSheetContent({
  isSubmitting,
  onSubmit,
  title,
}: ReportSheetContentProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState<PickedImage | null>(null);

  const handlePickEvidence = async () => {
    const [picked] = await pickGalleryImages({ selectionLimit: 1 });
    if (picked) {
      setEvidence(picked);
    }
  };

  const handleSubmit = () => {
    if (!reason) {
      return;
    }
    onSubmit({
      details: details.trim() || undefined,
      evidenceImageDataUrl: evidence
        ? `data:${evidence.mimeType};base64,${evidence.base64}`
        : undefined,
      reason,
    });
  };

  return (
    <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <VStack className="gap-4 px-5 pb-2" space="md">
        <Heading className="font-inter-bold" size="lg">
          {title}
        </Heading>

        <VStack space="xs">
          <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
            Reason
          </Text>
          <VStack className="gap-1.5">
            {REPORT_REASONS.map((option) => {
              const isActive = reason === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className={`flex-row items-center justify-between rounded-2xl px-4 py-3 ${
                    isActive ? 'bg-accent' : 'bg-secondary'
                  }`}
                  key={option}
                  onPress={() => setReason(option)}
                >
                  <Text
                    className={`font-inter-medium text-[14px] ${
                      isActive ? 'text-accent-foreground' : 'text-content'
                    }`}
                  >
                    {REPORT_REASON_LABEL[option]}
                  </Text>
                  {isActive ? <Icon name="Check" size={16} /> : null}
                </Pressable>
              );
            })}
          </VStack>
        </VStack>

        <VStack space="xs">
          <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
            Additional details (optional)
          </Text>
          <GrowingTextInput
            className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
            minHeight={80}
            onChangeText={setDetails}
            placeholder="Anything that would help a moderator understand what happened"
            value={details}
          />
        </VStack>

        <VStack space="xs">
          <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
            Evidence (optional)
          </Text>
          {evidence ? (
            <HStack className="items-center gap-3">
              <Image
                className="h-16 w-16 rounded-xl"
                resizeMode="cover"
                source={{ uri: evidence.uri }}
              />
              <Pressable accessibilityRole="button" onPress={() => setEvidence(null)}>
                <Text className="font-inter-semibold text-[13px] text-accent">
                  Remove
                </Text>
              </Pressable>
            </HStack>
          ) : (
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center gap-2 self-start rounded-full bg-secondary px-4 py-2.5"
              onPress={handlePickEvidence}
            >
              <Icon name="Image" size={16} />
              <Text className="font-inter-medium text-[13px] text-content">
                Add a screenshot
              </Text>
            </Pressable>
          )}
        </VStack>

        <Button
          className="rounded-full bg-accent"
          isDisabled={!reason || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <ButtonText className="font-inter-semibold text-[14px] text-accent-foreground">
              Submit report
            </ButtonText>
          )}
        </Button>
      </VStack>
    </ScrollView>
  );
}

interface ReportSheetProps extends ReportSheetContentProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

// Self-contained Sheet + form, for a screen with no other Sheet of its own
// to embed ReportSheetContent inside (e.g. member-profile-screen.tsx's
// plain content rows).
export function ReportSheet({
  isSubmitting,
  onClose,
  onSubmit,
  title,
  visible,
}: ReportSheetProps) {
  // One Sheet instance reused for every target its screen can report, not
  // remounted per target -- reset the form fresh each time it's opened
  // rather than carrying over the previous report's reason/details/evidence.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (visible) {
      setFormKey((key) => key + 1);
    }
  }, [visible]);

  return (
    <Sheet onClose={onClose} visible={visible}>
      <ReportSheetContent
        isSubmitting={isSubmitting}
        key={formKey}
        onSubmit={onSubmit}
        title={title}
      />
    </Sheet>
  );
}
