'use client';

import { useState, useTransition } from 'react';

import { deleteContentAction, type DeletableTable } from './actions';

interface DeleteButtonProps {
  readonly table: DeletableTable;
  readonly id: string;
  readonly confirmLabel: string;
}

export function DeleteButton({ table, id, confirmLabel }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm(confirmLabel)) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await deleteContentAction(table, id);
        if (result.warning) {
          setError(result.warning);
        }
      } catch {
        setError('Failed to delete. Try again.');
      }
    });
  };

  return (
    <span>
      <button
        className="text-xs text-danger underline decoration-dotted disabled:opacity-60"
        disabled={isPending}
        onClick={handleDelete}
        type="button"
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <span className="ml-2 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
