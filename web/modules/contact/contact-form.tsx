'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

import { CactusSpinner } from '@/components/brand/cactus-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'idle' | 'submitting' | 'done' | 'error';

const TEXTAREA_CLASS =
  'flex min-h-32 w-full rounded-md border border-input bg-paper px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function ContactForm({ className }: { className?: string }) {
  const nameId = React.useId();
  const emailId = React.useId();
  const subjectId = React.useId();
  const messageId = React.useId();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setStatus('done');
    } catch {
      setStatus('error');
      setError('Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Thanks — we&apos;ll get back to you soon.</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            required
            placeholder="Your name"
            className="mt-1.5"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div>
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            required
            placeholder="you@example.com"
            className="mt-1.5"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor={subjectId}>Subject</Label>
        <Input
          id={subjectId}
          required
          placeholder="What's this about?"
          className="mt-1.5"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={status === 'submitting'}
        />
      </div>
      <div className="mt-4">
        <Label htmlFor={messageId}>Message</Label>
        <textarea
          id={messageId}
          required
          placeholder="Questions, feedback, ideas — whatever's on your mind."
          className={`mt-1.5 ${TEXTAREA_CLASS}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={status === 'submitting'}
        />
      </div>
      {status === 'error' && error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" className="mt-5" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          <>
            <CactusSpinner className="h-4 w-4" />
            Sending
          </>
        ) : (
          'Send message'
        )}
      </Button>
    </form>
  );
}
