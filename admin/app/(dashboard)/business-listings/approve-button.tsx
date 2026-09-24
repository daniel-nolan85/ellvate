'use client';

import { useState, useTransition } from 'react';

import { approveBusinessListingAction } from '../actions';

interface ApproveButtonProps {
  readonly listingId: string;
}

export function ApproveButton({ listingId }: ApproveButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await approveBusinessListingAction(listingId);
        setDone(true);
      } catch {
        setError('Failed to approve. Try again.');
      }
    });
  };

  if (done) {
    return <span className="text-xs font-medium text-success">Approved</span>;
  }

  return (
    <span>
      <button
        className="rounded-full border border-success/50 bg-success/10 px-3 py-1 text-xs font-medium text-success disabled:opacity-60"
        disabled={isPending}
        onClick={handleApprove}
        type="button"
      >
        {isPending ? 'Approving…' : 'Approve'}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
