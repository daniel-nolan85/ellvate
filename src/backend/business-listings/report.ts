import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import type { ValidReportSubmission } from '../reports/report-submission';
import { reportBusinessListingSupabase } from './business-listings-supabase';
import type { ReportBusinessListingResult } from './types';

function reportBusinessListingMemory(
  userId: string,
  listingId: string,
  submission: ValidReportSubmission,
): ReportBusinessListingResult {
  if (!getState().businessListings.some((listing) => listing.id === listingId)) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().businessListingReports.some(
    (report) => report.businessListingId === listingId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      businessListingReports: [
        ...current.businessListingReports,
        {
          businessListingId: listingId,
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `business-listing-report-${crypto.randomUUID()}`,
          reason: submission.reason,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function reportBusinessListing(
  ctx: RequestContext,
  listingId: string,
  submission: ValidReportSubmission,
): Promise<ReportBusinessListingResult> {
  return ctx.supabase
    ? reportBusinessListingSupabase(ctx.supabase, ctx.userId, listingId, submission)
    : reportBusinessListingMemory(ctx.userId, listingId, submission);
}
