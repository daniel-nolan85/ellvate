'use client';

import { useState, useTransition } from 'react';

import { unpublishBusinessListingAction } from './actions';

interface UnpublishButtonProps {
  readonly listingId: string;
  readonly reportId: string;
}

// The report-queue counterpart to DeleteButton for a "Business listing"
// row -- sends the listing back to pending review instead of deleting it.
// See unpublishBusinessListingAction's own comment for why this exists
// alongside, not instead of, Delete.
export function UnpublishButton({ listingId, reportId }: UnpublishButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUnpublish = () => {
    if (
      !window.confirm(
        'Unpublish this listing and send it back to pending review? It stays in the database and its owner is notified -- this resolves the report without deleting anything.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await unpublishBusinessListingAction(listingId, reportId);
      } catch {
        setError('Failed to unpublish. Try again.');
      }
    });
  };

  return (
    <span>
      <button
        className="text-xs text-content underline decoration-dotted disabled:opacity-60"
        disabled={isPending}
        onClick={handleUnpublish}
        type="button"
      >
        {isPending ? 'Unpublishing…' : 'Send back to pending'}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
