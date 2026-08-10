'use client';

import { useTransition } from 'react';

import { toggleEventFeaturedAction } from '../actions';

interface FeaturedToggleProps {
  readonly eventId: string;
  readonly featured: boolean;
}

export function FeaturedToggle({ eventId, featured }: FeaturedToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-60 ${
        featured
          ? 'border-warning/50 bg-warning/10 text-warning'
          : 'border-border text-muted hover:text-content'
      }`}
      disabled={isPending}
      onClick={() =>
        startTransition(() => toggleEventFeaturedAction(eventId, !featured))
      }
      type="button"
    >
      {isPending ? '…' : featured ? '★ Featured' : 'Feature'}
    </button>
  );
}
