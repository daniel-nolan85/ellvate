'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

import { requestSignInCode, verifySignInCode } from './actions';

type SendState = 'idle' | 'sending' | 'awaiting_code' | 'not_allowed' | 'rate_limited' | 'error';
type VerifyState = 'idle' | 'verifying' | 'invalid' | 'not_allowed' | 'error';

function LoginForm() {
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get('error') === 'not_allowed';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    setState('sending');

    const result = await requestSignInCode(email);
    setState(result.ok ? 'awaiting_code' : result.reason);
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setVerifyState('verifying');

    const result = await verifySignInCode(email, code.trim());
    if (result.ok) {
      // Hard navigation so the freshly-set session cookie is picked up by
      // middleware on the very next request, rather than relying on a
      // client-side route transition to notice it.
      window.location.assign('/');
      return;
    }
    setVerifyState(result.reason);
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

        {state === 'awaiting_code' ? (
          <form className="space-y-3" onSubmit={handleVerifyCode}>
            <p className="text-sm text-muted">
              We sent a sign-in code to <span className="text-content">{email}</span>. Enter it
              below.
            </p>
            <input
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center text-lg tracking-[0.3em] text-content outline-none focus:border-accent"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setCode(event.target.value)}
              placeholder="12345678"
              required
              value={code}
            />
            <button
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              disabled={verifyState === 'verifying'}
              type="submit"
            >
              {verifyState === 'verifying' ? 'Verifying…' : 'Verify code'}
            </button>
            {verifyState === 'invalid' ? (
              <p className="text-sm text-danger">
                That code is wrong or expired. Try sending a new one.
              </p>
            ) : null}
            {verifyState === 'not_allowed' ? (
              <p className="text-sm text-danger">That email doesn&apos;t have admin access.</p>
            ) : null}
            {verifyState === 'error' ? (
              <p className="text-sm text-danger">Something went wrong. Try again.</p>
            ) : null}
            <button
              className="w-full text-sm text-muted underline"
              onClick={() => {
                setState('idle');
                setVerifyState('idle');
                setCode('');
              }}
              type="button"
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleSendCode}>
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
              {state === 'sending' ? 'Sending…' : 'Send sign-in code'}
            </button>
            {state === 'rate_limited' ? (
              <p className="text-sm text-danger">
                Too many sign-in emails sent to this address recently —
                Supabase&apos;s default email service caps this low. Wait a
                bit and try again.
              </p>
            ) : null}
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
