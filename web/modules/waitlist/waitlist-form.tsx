'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

import { CactusSpinner } from '@/components/brand/cactus-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRAND } from '@/lib/content';

import { useWaitlistStatus } from './waitlist-context';

type SubmitState = 'idle' | 'submitting' | 'error';

export function WaitlistForm({ className }: { className?: string }) {
  const inputId = React.useId();
  const [email, setEmail] = React.useState('');
  const [submitState, setSubmitState] = React.useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Shared across every WaitlistForm on the page, so submitting this one
  // also flips any other instance (e.g. the footer's) to the done state.
  const { status, message, markDone } = useWaitlistStatus();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState('submitting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSubmitState('error');
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      markDone(
        data.alreadyJoined
          ? "You're already on the list — we'll be in touch."
          : `You're on the list. We'll email you when ${BRAND.appName} launches.`
      );
    } catch {
      setSubmitState('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Label htmlFor={inputId} className="sr-only">
            Email address
          </Label>
          <Input
            id={inputId}
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitState === 'submitting'}
            aria-invalid={submitState === 'error'}
          />
        </div>
        <Button type="submit" size="lg" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? (
            <>
              <CactusSpinner className="h-4 w-4" />
              Joining
            </>
          ) : (
            'Join the waitlist'
          )}
        </Button>
      </div>
      {submitState === 'error' && errorMessage ? (
        <p className="mt-2 text-sm text-danger">{errorMessage}</p>
      ) : null}
    </form>
  );
}
