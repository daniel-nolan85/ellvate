'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

import { requestMagicLink } from './actions';

type SendState = 'idle' | 'sending' | 'awaiting_link' | 'not_allowed' | 'error';
type CompleteState = 'idle' | 'completing' | 'error';

// Pulls the `code` query param out of whatever the admin pastes -- the full
// failed-to-load localhost URL from their address bar, ideally, but falls
// back to treating the input as a bare code if it doesn't parse as a URL
// (e.g. if they only copied the query string, or the code itself).
function extractCode(pasted: string): string {
  const trimmed = pasted.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('code') ?? trimmed;
  } catch {
    const match = trimmed.match(/code=([^&\s]+)/);
    const captured = match?.[1];
    return captured ? decodeURIComponent(captured) : trimmed;
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get('error') === 'not_allowed';

  const [email, setEmail] = useState('');
  const [pastedLink, setPastedLink] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const [completeState, setCompleteState] = useState<CompleteState>('idle');

  const handleSendLink = async (event: FormEvent) => {
    event.preventDefault();
    setState('sending');

    const result = await requestMagicLink(email);
    setState(result.ok ? 'awaiting_link' : result.reason);
  };

  const handleCompleteSignIn = (event: FormEvent) => {
    event.preventDefault();
    setCompleteState('completing');

    const code = extractCode(pastedLink);
    if (!code) {
      setCompleteState('error');
      return;
    }

    // Hard navigation to the existing callback route, which already does
    // exchangeCodeForSession(code) -- this just gets it the code by a
    // different path than the (currently broken) redirect would have.
    window.location.assign(`/auth/callback?code=${encodeURIComponent(code)}`);
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

        {state === 'not_allowed' ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            That email doesn&apos;t have admin access.
          </p>
        ) : null}

        {state === 'awaiting_link' ? (
          <form className="space-y-3" onSubmit={handleCompleteSignIn}>
            <p className="text-sm text-muted">
              We sent a sign-in link to <span className="text-content">{email}</span>.
              Click it — it&apos;ll fail to load (it points to the wrong place
              until Auth settings are fixed), but copy the full address from
              your browser&apos;s address bar afterward and paste it below.
            </p>
            <input
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
              onChange={(event) => setPastedLink(event.target.value)}
              placeholder="http://localhost:3000/?code=..."
              required
              value={pastedLink}
            />
            <button
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              disabled={completeState === 'completing'}
              type="submit"
            >
              {completeState === 'completing' ? 'Signing in…' : 'Finish sign-in'}
            </button>
            {completeState === 'error' ? (
              <p className="text-sm text-danger">
                That link didn&apos;t have a usable code, or signing in
                failed — it may have expired. Try sending a new one.
              </p>
            ) : null}
            <button
              className="w-full text-sm text-muted underline"
              onClick={() => setState('idle')}
              type="button"
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleSendLink}>
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
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
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
