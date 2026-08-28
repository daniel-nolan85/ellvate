'use client';

import { useState, useTransition } from 'react';

import { toggleUserAdminAction } from '../actions';

interface AdminToggleProps {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export function AdminToggle({ isAdmin, userId }: AdminToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleUserAdminAction(userId, !isAdmin);
      } catch {
        setError('Failed to update. Try again.');
      }
    });
  };

  return (
    <span>
      <button
        className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-60 ${
          isAdmin
            ? 'border-warning/50 bg-warning/10 text-warning'
            : 'border-border text-muted hover:text-content'
        }`}
        disabled={isPending}
        onClick={handleToggle}
        type="button"
      >
        {isPending ? '…' : isAdmin ? '✓ Admin' : 'Make admin'}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
