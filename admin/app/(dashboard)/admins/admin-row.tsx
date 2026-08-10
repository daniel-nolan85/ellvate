'use client';

import { useState, useTransition } from 'react';

import { removeAdminAction } from '../actions';

interface AdminRowProps {
  readonly email: string;
  readonly actingEmail: string;
  readonly createdAt: string;
}

export function AdminRow({ email, actingEmail, createdAt }: AdminRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = email.toLowerCase() === actingEmail.toLowerCase();

  const handleRemove = () => {
    if (!window.confirm(`Remove ${email} as an admin?`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeAdminAction(email);
      setError(result.ok ? null : (result.message ?? 'Something went wrong.'));
    });
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 text-sm text-content">
        {email}
        {isSelf ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
      </td>
      <td className="py-2 pr-4 text-xs text-muted">
        {new Date(createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 text-right">
        {!isSelf && (
          <button
            className="text-xs text-danger underline decoration-dotted disabled:opacity-60"
            disabled={isPending}
            onClick={handleRemove}
            type="button"
          >
            {isPending ? 'Removing…' : 'Remove'}
          </button>
        )}
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </td>
    </tr>
  );
}
