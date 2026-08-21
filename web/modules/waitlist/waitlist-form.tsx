'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

import { CactusSpinner } from '@/components/brand/cactus-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRAND } from '@/lib/content';

type Status = 'idle' | 'submitting' | 'done' | 'error';

export function WaitlistForm({ className }: { className?: string }) {
  const inputId = React.useId();
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setStatus('done');
      setMessage(
        data.alreadyJoined
          ? "You're already on the list — we'll be in touch."
          : `You're on the list. We'll email you when ${BRAND.appName} launches.`
      );
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
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
            disabled={status === 'submitting'}
            aria-invalid={status === 'error'}
          />
        </div>
        <Button type="submit" size="lg" disabled={status === 'submitting'}>
          {status === 'submitting' ? (
            <>
              <CactusSpinner className="h-4 w-4" />
              Joining
            </>
          ) : (
            'Join the waitlist'
          )}
        </Button>
      </div>
      {status === 'error' && message ? (
        <p className="mt-2 text-sm text-danger">{message}</p>
      ) : null}
    </form>
  );
}
