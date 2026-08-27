'use client';

import { useTransition } from 'react';

import { toggleUserAdminAction } from '../actions';

interface AdminToggleProps {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export function AdminToggle({ isAdmin, userId }: AdminToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-60 ${
        isAdmin
          ? 'border-warning/50 bg-warning/10 text-warning'
          : 'border-border text-muted hover:text-content'
      }`}
      disabled={isPending}
      onClick={() =>
        startTransition(() => toggleUserAdminAction(userId, !isAdmin))
      }
      type="button"
    >
      {isPending ? '…' : isAdmin ? '✓ Admin' : 'Make admin'}
    </button>
  );
}
