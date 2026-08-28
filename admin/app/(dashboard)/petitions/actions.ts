'use server';

import { revalidatePath } from 'next/cache';

import { sendHoaEmail } from '@/lib/hoa-email';
import { requireAdminEmail } from '@/lib/require-admin-email';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface SendPetitionToHoaResult {
  readonly ok: boolean;
  readonly message?: string;
}

// The one irreversible action this whole dashboard triggers on an outside
// party -- unlike deleting content, an email already sent to the actual HOA
// board can't be pulled back. So this requires an admin to be signed in
// (requireAdminEmail), takes the exact subject/body the admin reviewed on
// the detail page (not a value regenerated server-side, so what they saw is
// what sends), and only fires once: a petition that's already got
// hoa_email_sent_at set is refused outright rather than silently re-sending.
export async function sendPetitionToHoaAction(
  petitionId: string,
  subject: string,
  body: string,
): Promise<SendPetitionToHoaResult> {
  await requireAdminEmail();

  const admin = createSupabaseAdminClient();
  const { data: petition, error: petitionError } = await admin
    .from('petitions')
    .select('id, status, hoa_email_sent_at')
    .eq('id', petitionId)
    .maybeSingle();
  if (petitionError) {
    throw petitionError;
  }
  if (!petition) {
    return { ok: false, message: 'Petition not found.' };
  }
  if (petition.status !== 'succeeded') {
    return { ok: false, message: 'Only succeeded petitions can be sent to the HOA board.' };
  }
  if (petition.hoa_email_sent_at) {
    return { ok: false, message: 'This petition has already been sent.' };
  }

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject || !trimmedBody) {
    return { ok: false, message: 'Subject and message are both required.' };
  }

  const sent = await sendHoaEmail(trimmedSubject, trimmedBody);
  if (!sent) {
    return {
      ok: false,
      message:
        'Sending to the HOA board failed. Nothing was recorded as sent -- try again.',
    };
  }

  const { error: updateError } = await admin
    .from('petitions')
    .update({ hoa_email_sent_at: new Date().toISOString() })
    .eq('id', petitionId);
  if (updateError) {
    throw updateError;
  }

  revalidatePath('/petitions');
  revalidatePath(`/petitions/${petitionId}`);
  return { ok: true };
}

interface SavePetitionHoaResponseResult {
  readonly ok: boolean;
  readonly message?: string;
}

// Records what the board actually said, transcribed by an admin from
// whatever real-world channel they replied through (this app has no way to
// ingest an email reply automatically). Setting hoa_response_at for the
// first time fires the petitions_notify_hoa_response DB trigger (0036),
// notifying every signer -- so this only ever moves forward: an admin can
// edit the wording later, but the first save is what triggers signers'
// notifications, and there's no "unsend" for that.
export async function savePetitionHoaResponseAction(
  petitionId: string,
  response: string,
): Promise<SavePetitionHoaResponseResult> {
  await requireAdminEmail();

  const trimmed = response.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter the board’s response.' };
  }

  const admin = createSupabaseAdminClient();
  const { data: petition, error: petitionError } = await admin
    .from('petitions')
    .select('id, hoa_response_at')
    .eq('id', petitionId)
    .maybeSingle();
  if (petitionError) {
    throw petitionError;
  }
  if (!petition) {
    return { ok: false, message: 'Petition not found.' };
  }

  const { error: updateError } = await admin
    .from('petitions')
    .update({
      hoa_response: trimmed,
      hoa_response_at: petition.hoa_response_at ?? new Date().toISOString(),
    })
    .eq('id', petitionId);
  if (updateError) {
    throw updateError;
  }

  revalidatePath('/petitions');
  revalidatePath(`/petitions/${petitionId}`);
  return { ok: true };
}
