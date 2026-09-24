// Shared by both the memory-mode and Supabase create paths (create.ts /
// business-listings-supabase.ts) so the verification pipeline itself lives
// in exactly one place. Runs after a listing's core fields are validated,
// before the row is persisted as pending -- callers attach the result to
// the row they're about to write.
//
// A matching contact-email/website domain is deliberately NOT sufficient on
// its own to verify a listing: anyone can register a domain and a matching
// mailbox for a business that doesn't exist, isn't local to Lake Las Vegas,
// or isn't appropriate for the app. Domain match is instead folded into the
// classifier call as one input signal, alongside the business's own fetched
// website content and submitted address -- only Claude's own "confident"
// verdict (see verification-classifier.ts's system prompt) ever verifies a
// listing. `method` still distinguishes 'domain_match' from 'ai_auto' for
// the admin queue/analytics, but both now require the same classifier pass.

import { getAccountEmail } from '@/src/backend/clerk';

import {
  classifyBusinessListing,
  type VerificationClassifierInput,
} from './verification-classifier';
import { extractDomain } from './validation';
import { fetchWebsiteSummary } from './website-fetch';
import type { ValidatedBusinessListing } from './types';

export interface VerificationOutcome {
  readonly status: 'pending' | 'verified';
  readonly method: 'domain_match' | 'ai_auto' | 'admin_manual' | null;
  readonly notes: string | null;
}

const PENDING_UNREVIEWED: VerificationOutcome = { method: null, notes: null, status: 'pending' };

async function resolveDomainMatch(userId: string, value: ValidatedBusinessListing): Promise<boolean> {
  const websiteDomain = extractDomain(value.contactWebsite);
  if (!websiteDomain) {
    return false;
  }
  const contactDomain = extractDomain(value.contactEmail);
  if (contactDomain === websiteDomain) {
    return true;
  }
  const accountEmail = await getAccountEmail(userId);
  return extractDomain(accountEmail) === websiteDomain;
}

export async function resolveVerification(
  userId: string,
  value: ValidatedBusinessListing,
  photoUrl: string | null,
): Promise<VerificationOutcome> {
  const [domainMatched, website] = await Promise.all([
    resolveDomainMatch(userId, value),
    // Fetched whenever a website is declared, regardless of domain match --
    // real content is a stronger positive signal than a matching string,
    // and an unreachable declared site is itself a red flag either way.
    value.contactWebsite ? fetchWebsiteSummary(value.contactWebsite) : Promise.resolve(null),
  ]);

  const classifierInput: VerificationClassifierInput = {
    address: value.address,
    businessName: value.businessName,
    category: value.category,
    contactEmail: value.contactEmail,
    contactWebsite: value.contactWebsite,
    description: value.description,
    domainMatched,
    photoUrl,
    website,
  };

  // Fails closed into 'pending' on any error, timeout, missing API key, or
  // an explicit "uncertain" verdict -- see verification-classifier.ts's own
  // module comment for why this is the only path that can ever verify.
  const verdict = await classifyBusinessListing(classifierInput);
  if (verdict?.verdict === 'confident') {
    return { method: domainMatched ? 'domain_match' : 'ai_auto', notes: null, status: 'verified' };
  }
  if (verdict?.verdict === 'uncertain') {
    return { method: null, notes: verdict.reasoning, status: 'pending' };
  }
  return PENDING_UNREVIEWED;
}
