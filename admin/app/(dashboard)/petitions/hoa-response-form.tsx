'use client';

import { useState, useTransition } from 'react';

import { savePetitionHoaResponseAction } from './actions';

interface HoaResponseFormProps {
  readonly petitionId: string;
  readonly initialResponse: string;
  readonly alreadyNotified: boolean;
}

export function HoaResponseForm({
  petitionId,
  initialResponse,
  alreadyNotified,
}: HoaResponseFormProps) {
  const [response, setResponse] = useState(initialResponse);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (
      !alreadyNotified &&
      !window.confirm('Save this response? Every signer will be notified.')
    ) {
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await savePetitionHoaResponseAction(petitionId, response);
      if (!result.ok) {
        setError(result.message ?? 'Failed to save.');
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-content">HOA board response</p>
        <p className="text-xs text-muted">
          {alreadyNotified
            ? 'Signers were already notified when this was first saved — editing the wording here does not notify them again.'
            : 'Transcribe what the board said, from whatever channel they actually replied through. Saving notifies every signer.'}
        </p>
      </div>

      <textarea
        className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-accent"
        onChange={(event) => setResponse(event.target.value)}
        placeholder="What did the board say?"
        rows={6}
        value={response}
      />

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {saved ? <p className="text-xs text-success">Saved.</p> : null}

      <button
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
        disabled={isPending || !response.trim()}
        onClick={handleSave}
        type="button"
      >
        {isPending ? 'Saving…' : alreadyNotified ? 'Update response' : 'Save & notify signers'}
      </button>
    </div>
  );
}
