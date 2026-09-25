'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { sendAccountRemovedEmail } from '@/lib/account-removed-email';
import { banClerkUser, getClerkUserEmail } from '@/lib/clerk';
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
  await requireAdminEmail();

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

// Manual approval for a business listing the automated verification tiers
// (domain match, then the Claude classifier -- see
// src/backend/business-listings/verification.ts) couldn't clear on their
// own. Rejection has no dedicated action: it's just the generic
// deleteContentAction with 'business_listings' in DELETABLE_CONTENT below,
// matching how every other report/queue resolution in this app already
// works (delete, don't soft-reject).
export async function approveBusinessListingAction(listingId: string) {
  await requireAdminEmail();

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from('business_listings')
    .select('id, business_name, created_by')
    .eq('id', listingId)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (!existing) {
    throw new Error('business_listing_not_found');
  }

  const { data, error } = await admin
    .from('business_listings')
    .update({
      verification_status: 'verified',
      verification_method: 'admin_manual',
      verification_notes: null,
      verified_at: new Date().toISOString(),
      claimed_by: existing.created_by,
    })
    .eq('id', listingId)
    .select('id, business_name, created_by')
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('business_listing_not_found');
  }

  // Reuses the app's existing notification system end to end -- read by
  // src/backend/notifications/, routed by resolveNotificationRoute's
  // businessId case, no new delivery mechanism needed for this feature.
  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: data.created_by,
    kind: 'business_listing_verified',
    title: 'Your listing is live',
    body: `${data.business_name} is now verified and visible in the Businesses directory.`,
    data: { businessId: data.id },
  });
  if (notifyError) {
    // Best-effort: the listing is already verified at this point, and a
    // failure to notify the owner shouldn't roll that back or surface as an
    // approval failure to the admin.
    console.error(`[admin] failed to notify ${data.created_by} of listing approval`, notifyError);
  }

  revalidatePath('/business-listings');
  revalidatePath(`/business-listings/${listingId}`);
}

// The gentler alternative to deleteContentAction for a reported business
// listing: unpublish it back to 'pending' (same as a brand-new, unverified
// listing -- hidden from everyone but its owner, sitting in the
// verification queue) instead of deleting it outright. A report against a
// long-established local business is often a dispute or a misunderstanding
// rather than proof the listing is fake, so this gives moderation a
// proportionate first step before the irreversible one. Resolves the
// specific report that prompted it (mirrors deleteContentAction's own
// "resolving a report clears its row" behavior) without touching the
// listing's other data -- the owner can be re-verified and go live again
// once whatever prompted the report is sorted out.
export async function unpublishBusinessListingAction(
  listingId: string,
  reportId: string,
) {
  await requireAdminEmail();

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from('business_listings')
    .select('id, business_name, created_by')
    .eq('id', listingId)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (!existing) {
    throw new Error('business_listing_not_found');
  }

  const { error } = await admin
    .from('business_listings')
    .update({
      verification_status: 'pending',
      verification_method: null,
      verification_notes: 'Unpublished after a report -- awaiting re-review.',
      verified_at: null,
      claimed_by: null,
    })
    .eq('id', listingId);
  if (error) {
    throw error;
  }

  const { error: reportError } = await admin
    .from('business_listing_reports')
    .delete()
    .eq('id', reportId);
  if (reportError) {
    throw reportError;
  }

  // Reuses the same notification system as approveBusinessListingAction --
  // resolveNotificationRoute routes on a bare businessId regardless of
  // `kind`, so no route-table change is needed for this new kind.
  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: existing.created_by,
    kind: 'business_listing_unpublished',
    title: 'Your listing was unpublished for review',
    body: `${existing.business_name} was reported and has been temporarily unpublished while we take a look. It hasn't been deleted, and you'll hear from us.`,
    data: { businessId: existing.id },
  });
  if (notifyError) {
    // Best-effort, same reasoning as approveBusinessListingAction: the
    // unpublish already happened, a failed notification shouldn't roll it
    // back or read as an action failure to the admin.
    console.error(`[admin] failed to notify ${existing.created_by} of listing unpublish`, notifyError);
  }

  revalidatePath('/business-listings');
  revalidatePath(`/business-listings/${listingId}`);
  revalidatePath('/reports');
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
  mission_check_ins: '/missions',
  service_listings: '/services',
  business_listings: '/business-listings',
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
interface DeleteContentResult {
  readonly ok: true;
  // Set when the row(s) were deleted but a best-effort side effect (banning
  // the Clerk identity, sending the removal email) didn't actually happen --
  // surfaced so an admin knows to go finish that step manually instead of
  // assuming deletion always means both silently succeeded too.
  readonly warning?: string;
}

export async function deleteContentAction(
  table: DeletableTable,
  id: string,
): Promise<DeleteContentResult> {
  await requireAdminEmail();

  // `table`'s static type restricts normal callers to a real key, but a
  // Server Action is a real network endpoint underneath -- callable with any
  // string regardless of what TypeScript allows at the call site. `in`/plain
  // indexing would resolve inherited Object.prototype keys like
  // '__proto__' or 'constructor', so this checks the object's OWN keys only.
  if (!Object.hasOwn(DELETABLE_CONTENT, table)) {
    throw new Error('invalid_table');
  }
  const revalidateTarget = DELETABLE_CONTENT[table];

  // Deleting an app_users row is otherwise not a real removal: ensureUser()
  // upserts a fresh row for any authenticated Clerk id with no row yet, so
  // the same person could just sign back in and start over. Ban their Clerk
  // identity first (id === the Clerk user id throughout this app) so that
  // can't happen, and grab their email while the account still exists so
  // there's something to notify once it's gone. Both are best-effort --
  // see lib/clerk.ts -- a moderator can still delete a user's content even
  // before CLERK_SECRET_KEY/RESEND_API_KEY are configured.
  const notifyEmail =
    table === 'app_users' ? await getClerkUserEmail(id) : null;
  let banFailed = false;
  if (table === 'app_users') {
    const banned = await banClerkUser(id);
    banFailed = Boolean(process.env.CLERK_SECRET_KEY) && !banned;
    if (banFailed) {
      console.error(`[admin] failed to ban Clerk user ${id} on account deletion`);
    }
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(table).delete().eq('id', id);
  if (error) {
    throw error;
  }

  let emailFailed = false;
  if (notifyEmail) {
    const sent = await sendAccountRemovedEmail(notifyEmail);
    emailFailed = Boolean(process.env.RESEND_API_KEY) && !sent;
  }

  revalidatePath(revalidateTarget);
  revalidatePath('/reports');

  if (banFailed && emailFailed) {
    return {
      ok: true,
      warning:
        'Content deleted, but banning the account in Clerk and sending the removal email both failed. Ban them manually in Clerk.',
    };
  }
  if (banFailed) {
    return {
      ok: true,
      warning:
        'Content deleted, but banning the account in Clerk failed. Ban them manually so they can’t sign back in.',
    };
  }
  if (emailFailed) {
    return { ok: true, warning: 'Content deleted, but the removal email failed to send.' };
  }
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
