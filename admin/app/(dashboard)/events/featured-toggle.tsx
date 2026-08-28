'use client';

import { useState, useTransition } from 'react';

import { toggleEventFeaturedAction } from '../actions';

interface FeaturedToggleProps {
  readonly eventId: string;
  readonly featured: boolean;
}

export function FeaturedToggle({ eventId, featured }: FeaturedToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleEventFeaturedAction(eventId, !featured);
      } catch {
        setError('Failed to update. Try again.');
      }
    });
  };

  return (
    <span>
      <button
        className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-60 ${
          featured
            ? 'border-warning/50 bg-warning/10 text-warning'
            : 'border-border text-muted hover:text-content'
        }`}
        disabled={isPending}
        onClick={handleToggle}
        type="button"
      >
        {isPending ? '…' : featured ? '★ Featured' : 'Feature'}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
