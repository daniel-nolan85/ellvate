import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { Avatar } from '@/src/components/ui/avatar';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { HStack } from '@/src/components/ui/hstack';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { useSession } from '@/src/platform/session';

import { CommentComposer } from './comment-composer';
import { CommentItem } from './comment-item';
import { formatRelativeTime } from './relative-time';
import {
  useCreateComment,
  useDeleteComment,
  usePostComments,
  type ForumComment,
} from './use-comments';
import { useForumPosts, useToggleLike } from './use-forum';

interface PostDetailScreenProps {
  readonly postId: string;
  readonly onBack: () => void;
}

export function PostDetailScreen({ postId, onBack }: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  const posts = useForumPosts('All');
  const post = useMemo(
    () => posts.data?.posts.find((entry) => entry.id === postId),
    [posts.data, postId],
  );
  const comments = usePostComments(postId);
  const createComment = useCreateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toggleLike = useToggleLike();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<ForumComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleReply = (name: string) => {
    setReplyTo(name);
    setDraft((current) => (current.length === 0 ? `@${name} ` : current));
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    createComment.mutate(body, {
      onSuccess: () => {
        setDraft('');
        setReplyTo(null);
        void Haptics.selectionAsync();
      },
      onError: () => showToast('Couldn’t post your comment. Try again.'),
    });
  };

  const commentList = comments.data?.comments ?? [];

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
          Post
        </Heading>
        <Icon color="rgb(113,113,123)" name="Share" size={18} />
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-[18px] py-4"
        >
          {post ? (
            <VStack className="gap-2.5">
              <HStack className="items-center gap-2">
                <Avatar name={post.author.name} size="sm" />
                <VStack className="flex-1 gap-0.5">
                  <Text className="font-inter-medium text-[14px] text-content">
                    {post.author.name}
                  </Text>
                  <Text className="text-[12px] text-text-muted">
                    {post.forum} · {formatRelativeTime(post.createdAt)}
                  </Text>
                </VStack>
              </HStack>
              <Heading className="font-inter-bold text-[19px]" size="md">
                {post.title}
              </Heading>
              {post.excerpt ? (
                <Text className="text-[15px] leading-[22px] text-muted-foreground">
                  {post.excerpt}
                </Text>
              ) : null}
              <HStack className="items-center gap-4">
                <Pressable
                  className="flex-row items-center gap-1"
                  onPress={() =>
                    toggleLike.mutate({ forum: 'All', postId: post.id })
                  }
                >
                  <Icon
                    color={post.liked ? 'rgb(99,102,241)' : 'rgb(113,113,123)'}
                    name="Favourite"
                    size={16}
                  />
                  <Text
                    className="text-[12px]"
                    style={{
                      color: post.liked ? 'rgb(99,102,241)' : 'rgb(113,113,123)',
                    }}
                  >
                    {post.likes}
                  </Text>
                </Pressable>
                <HStack className="items-center gap-1">
                  <Icon color="rgb(113,113,123)" name="MessageCircle" size={16} />
                  <Text className="text-[12px] text-text-muted">
                    {post.replies}
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          ) : posts.isPending ? (
            <View className="items-center py-10">
              <Spinner />
            </View>
          ) : (
            <Text className="text-text-muted" size="sm">
              This post is no longer available.
            </Text>
          )}

          <Divider />
          <Text className="font-inter-semibold text-[13px] text-content">
            {post?.replies ?? commentList.length} comments
          </Text>

          {comments.isPending ? (
            <View className="items-center py-6">
              <Spinner />
            </View>
          ) : commentList.length === 0 ? (
            <Text className="py-2 text-text-muted" size="sm">
              No comments yet — start the conversation.
            </Text>
          ) : (
            <VStack className="gap-4">
              {commentList.map((comment) => (
                <CommentItem
                  comment={comment}
                  key={comment.id}
                  onActions={setActionsFor}
                  onReply={handleReply}
                />
              ))}
            </VStack>
          )}
        </ScrollView>

        <CommentComposer
          isSending={createComment.isPending}
          onChangeText={setDraft}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          replyTo={replyTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={() => setActionsFor(null)}
        transparent
        visible={actionsFor !== null}
      >
        <Pressable
          className="flex-1 bg-[rgba(0,0,0,0.4)]"
          onPress={() => setActionsFor(null)}
        />
        <View
          className="absolute bottom-0 left-0 right-0 gap-1 rounded-t-[20px] bg-canvas px-[18px] pt-2.5"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-line" />
          <SheetRow
            icon="Link"
            label="Copy link to comment"
            onPress={() => {
              setActionsFor(null);
              showToast('Link copied');
            }}
          />
          <Divider />
          <SheetRow
            icon="EyeOff"
            label="Mute this neighbour"
            onPress={() => {
              setActionsFor(null);
              showToast('Muted');
            }}
          />
          <Divider />
          {actionsFor && actionsFor.author.id === userId ? (
            <SheetRow
              destructive
              icon="AlertCircle"
              label="Delete comment"
              onPress={() => {
                const target = actionsFor;
                setActionsFor(null);
                deleteComment.mutate(target.id);
              }}
            />
          ) : (
            <SheetRow
              destructive
              icon="AlertCircle"
              label="Report comment"
              onPress={() => {
                setActionsFor(null);
                showToast('Thanks — our moderators will take a look.');
              }}
            />
          )}
        </View>
      </Modal>

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

interface SheetRowProps {
  readonly icon: 'Link' | 'EyeOff' | 'AlertCircle';
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

function SheetRow({ icon, label, onPress, destructive }: SheetRowProps) {
  const color = destructive ? 'rgb(231,0,11)' : 'rgb(10,10,10)';
  return (
    <Pressable
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
