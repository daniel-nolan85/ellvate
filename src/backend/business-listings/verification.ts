// Shared by both the memory-mode and Supabase create paths (create.ts /
// business-listings-supabase.ts) so the two-tier verification pipeline
// itself lives in exactly one place. Runs after a listing's core fields are
// validated, before the row is persisted as pending -- callers attach the
// result to the row they're about to write.

import { getAccountEmail } from '@/src/backend/clerk';

import { classifyBusinessListing } from './verification-classifier';
import { extractDomain } from './validation';
import type { ValidatedBusinessListing } from './types';

export interface VerificationOutcome {
  readonly status: 'pending' | 'verified';
  readonly method: 'domain_match' | 'ai_auto' | 'admin_manual' | null;
  readonly notes: string | null;
}

const PENDING_UNREVIEWED: VerificationOutcome = { method: null, notes: null, status: 'pending' };

export async function resolveVerification(
  userId: string,
  value: ValidatedBusinessListing,
  photoUrl: string | null,
): Promise<VerificationOutcome> {
  const websiteDomain = extractDomain(value.contactWebsite);

  // Deterministic tier: no AI call, and always tried first since it's
  // free and instant when it resolves.
  if (websiteDomain) {
    const contactDomain = extractDomain(value.contactEmail);
    const accountEmail = await getAccountEmail(userId);
    const accountDomain = extractDomain(accountEmail);
    if (contactDomain === websiteDomain || accountDomain === websiteDomain) {
      return { method: 'domain_match', notes: null, status: 'verified' };
    }
  }

  // Assisted tier: only reached when the deterministic tier couldn't
  // resolve it (no website, or a genuine mismatch). Fails closed into
  // 'pending' on any error, timeout, or missing API key -- see
  // verification-classifier.ts's own module comment for why.
  const verdict = await classifyBusinessListing({
    businessName: value.businessName,
    category: value.category,
    contactEmail: value.contactEmail,
    contactWebsite: value.contactWebsite,
    description: value.description,
    photoUrl,
  });
  if (verdict?.verdict === 'confident') {
    return { method: 'ai_auto', notes: null, status: 'verified' };
  }
  if (verdict?.verdict === 'uncertain') {
    return { method: null, notes: verdict.reasoning, status: 'pending' };
  }
  return PENDING_UNREVIEWED;
}
