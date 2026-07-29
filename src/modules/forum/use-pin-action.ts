import { useRef, useState } from 'react';

import { useTogglePin, type ForumPost } from './use-forum';
import { usePinExplainerDismissed } from './use-pin-explainer';

interface PinActionCallbacks {
  readonly onSuccess?: (pinned: boolean) => void;
  readonly onError?: () => void;
}

// Shared pin-request state for screens that render many PostCards at once
// (the forum list) — rendering one <PinExplainerModal> per card caused
// multiple simultaneous <Modal> mounts to conflict on web (clicks landed on
// whatever page content was underneath instead of the modal's own buttons).
// A single shared instance, rendered once by the screen and fed a postId
// via requestTogglePin, sidesteps that entirely. Screens that only ever
// show one PostCard at a time (bookmarks/activity/digest preview sheets)
// don't need this — PostCard falls back to its own local modal there.
export function usePinAction() {
  const togglePin = useTogglePin();
  const pinExplainer = usePinExplainerDismissed();
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const callbacksRef = useRef<PinActionCallbacks>({});

  const doToggle = (postId: string, callbacks: PinActionCallbacks) => {
    togglePin.mutate(postId, {
      onError: () => callbacks.onError?.(),
      onSuccess: (result) => callbacks.onSuccess?.(result.pinned),
    });
  };

  const requestTogglePin = (
    post: ForumPost,
    callbacks: PinActionCallbacks = {},
  ) => {
    if (!post.pinned && !pinExplainer.dismissed) {
      setPendingPostId(post.id);
      callbacksRef.current = callbacks;
      return;
    }
    doToggle(post.id, callbacks);
  };

  const confirmPending = (dontShowAgain: boolean) => {
    const postId = pendingPostId;
    const callbacks = callbacksRef.current;
    setPendingPostId(null);
    callbacksRef.current = {};
    if (dontShowAgain) {
      void pinExplainer.dismissForever();
    }
    if (postId) {
      doToggle(postId, callbacks);
    }
  };

  const cancelPending = () => {
    setPendingPostId(null);
    callbacksRef.current = {};
  };

  return {
    cancelPending,
    confirmPending,
    explainerVisible: pendingPostId !== null,
    requestTogglePin,
  };
}

export type PinAction = ReturnType<typeof usePinAction>;
