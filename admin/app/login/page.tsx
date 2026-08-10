'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

function LoginForm() {
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get('error') === 'not_allowed';

  const [email, setEmail] = useState('');
  const [state, setState] = useState<SendState>('idle');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setState('sending');

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setState(error ? 'error' : 'sent');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-content">LLV Community — Admin</h1>
          <p className="text-sm text-muted">Sign in with your admin email.</p>
        </div>

        {notAllowed ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            That email isn&apos;t on the admin list. Ask an existing admin to add you.
          </p>
        ) : null}

        {state === 'sent' ? (
          <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <button
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              disabled={state === 'sending'}
              type="submit"
            >
              {state === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {state === 'error' ? (
              <p className="text-sm text-danger">Something went wrong. Try again.</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
