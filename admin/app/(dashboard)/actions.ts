'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Server Actions are callable directly, not just through the rendered UI --
// so the acting admin's identity must come from their own session, never
// from a client-supplied argument (that would let anyone spoof who
// performed an add/remove for the audit trail).
async function requireAdminEmail(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect('/login');
  }
  return user.email;
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function toggleEventFeaturedAction(
  eventId: string,
  nextFeatured: boolean,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('events')
    .update({ featured: nextFeatured })
    .eq('id', eventId);

  if (error) {
    throw error;
  }
  revalidatePath('/events');
}

interface AddAdminResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function addAdminAction(
  newEmail: string,
): Promise<AddAdminResult> {
  const actingEmail = await requireAdminEmail();

  const trimmed = newEmail.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('dashboard_admins')
    .insert({ email: trimmed, added_by: actingEmail });

  if (error) {
    // Unique violation on email -- already an admin, not a real failure.
    if (error.code === '23505') {
      return { ok: false, message: 'That email is already an admin.' };
    }
    throw error;
  }

  revalidatePath('/admins');
  return { ok: true };
}

export async function removeAdminAction(
  targetEmail: string,
): Promise<AddAdminResult> {
  const actingEmail = await requireAdminEmail();

  const admin = createSupabaseAdminClient();

  // Two guardrails so this table can never remove every admin, including
  // the one taking the action right now: no self-removal, and never let the
  // last remaining admin be removed.
  if (targetEmail.toLowerCase() === actingEmail.toLowerCase()) {
    return { ok: false, message: 'You can’t remove your own access.' };
  }

  const { count, error: countError } = await admin
    .from('dashboard_admins')
    .select('id', { count: 'exact', head: true });
  if (countError) {
    throw countError;
  }
  if ((count ?? 0) <= 1) {
    return { ok: false, message: 'At least one admin must remain.' };
  }

  const { error } = await admin
    .from('dashboard_admins')
    .delete()
    .eq('email', targetEmail.toLowerCase());
  if (error) {
    throw error;
  }

  revalidatePath('/admins');
  return { ok: true };
}
