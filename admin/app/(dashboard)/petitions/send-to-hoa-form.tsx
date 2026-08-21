'use client';

import { useState, useTransition } from 'react';

import { sendPetitionToHoaAction } from './actions';

interface SendToHoaFormProps {
  readonly petitionId: string;
  readonly initialSubject: string;
  readonly initialBody: string;
}

export function SendToHoaForm({ petitionId, initialSubject, initialBody }: SendToHoaFormProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!window.confirm('Send this email to the HOA board? This cannot be undone.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await sendPetitionToHoaAction(petitionId, subject, body);
      if (!result.ok) {
        setError(result.message ?? 'Failed to send.');
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-success">
        Sent to the HOA board.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-content">Send to HOA board</p>
        <p className="text-xs text-muted">
          Review and edit the message before sending — this goes out to the actual
          board and can&apos;t be recalled once sent.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Subject</span>
        <input
          className="w-full rounded-lg border border-border bg-canvas px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          onChange={(event) => setSubject(event.target.value)}
          type="text"
          value={subject}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Message</span>
        <textarea
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-accent"
          onChange={(event) => setBody(event.target.value)}
          rows={10}
          value={body}
        />
      </label>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <button
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        disabled={isPending || !subject.trim() || !body.trim()}
        onClick={handleSend}
        type="button"
      >
        {isPending ? 'Sending…' : 'Send to HOA board'}
      </button>
    </div>
  );
}
