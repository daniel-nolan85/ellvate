'use client';

import { useActionState } from 'react';

import { addAdminAction } from '../actions';

interface FormState {
  readonly message: string | null;
}

export function AddAdminForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_previous, formData) => {
      const email = String(formData.get('email') ?? '');
      const result = await addAdminAction(email);
      return { message: result.ok ? null : (result.message ?? 'Something went wrong.') };
    },
    { message: null },
  );

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="space-y-1">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          name="email"
          placeholder="new-admin@example.com"
          required
          type="email"
        />
        {state.message ? <p className="text-xs text-danger">{state.message}</p> : null}
      </div>
      <button
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Adding…' : 'Add admin'}
      </button>
    </form>
  );
}
