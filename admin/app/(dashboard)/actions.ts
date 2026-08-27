'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminEmail } from '@/lib/require-admin-email';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  revalidatePath(`/events/${eventId}`);
}

// Distinct from dashboard_admins above -- this flags an app_users row (a
// community member) whose content gets an "admin" mark in the mobile app,
// not who may sign in to this moderation tool.
export async function toggleUserAdminAction(
  userId: string,
  nextIsAdmin: boolean,
) {
  await requireAdminEmail();

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('app_users')
    .update({ is_admin: nextIsAdmin })
    .eq('id', userId);

  if (error) {
    throw error;
  }
  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
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

// Every table a moderator can delete from, and the path to revalidate after
// doing so. An explicit allowlist (rather than trusting a client-supplied
// table name outright) keeps this action from becoming an arbitrary-row-
// delete primitive if it's ever called directly instead of through the UI.
const DELETABLE_CONTENT = {
  posts: '/posts',
  comments: '/comments',
  event_comments: '/comments',
  mission_comments: '/comments',
  service_reviews: '/comments',
  events: '/events',
  missions: '/missions',
  service_listings: '/services',
  mission_check_ins: '/reports',
  app_users: '/users',
  contact_messages: '/contact',
  landing_contact_messages: '/contact',
  waitlist_signups: '/waitlist',
  petitions: '/petitions',
  petition_comments: '/comments',
} as const;

export type DeletableTable = keyof typeof DELETABLE_CONTENT;

// Deleting the row here is the only "resolve" action a report gets -- every
// report table cascades from its target content (see the 0007/0017/0020/0025
// migrations), so removing the content also clears any reports filed against
// it. There's no separate "dismiss without deleting" status in the schema.
export async function deleteContentAction(table: DeletableTable, id: string) {
  await requireAdminEmail();

  const revalidateTarget = DELETABLE_CONTENT[table];
  if (!revalidateTarget) {
    throw new Error('invalid_table');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(table).delete().eq('id', id);
  if (error) {
    throw error;
  }

  revalidatePath(revalidateTarget);
  revalidatePath('/reports');
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

  // added_by has no ON DELETE behavior (references dashboard_admins(email)
  // with the default RESTRICT), so removing someone who'd added other
  // admins would otherwise fail with a foreign key violation. Clear those
  // references first -- who invited them is no longer knowable once the
  // inviter's gone, which is fine, but it shouldn't block removal.
  const { error: clearAddedByError } = await admin
    .from('dashboard_admins')
    .update({ added_by: null })
    .eq('added_by', targetEmail.toLowerCase());
  if (clearAddedByError) {
    throw clearAddedByError;
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
