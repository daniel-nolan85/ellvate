import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useNotifyXpAwarded, type XpAwardOutcome } from '@/src/modules/xp';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type BusinessCategory =
  | 'restaurants-bars'
  | 'goods'
  | 'hospitality'
  | 'professional-trade';

export type VerificationStatus = 'pending' | 'verified';
export type VerificationMethod = 'domain_match' | 'ai_auto' | 'admin_manual';

export interface BusinessMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface BusinessListing {
  readonly id: string;
  readonly author: PersonRef;
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly currentSpecial: string | null;
  readonly specialUpdatedAt: string | null;
  readonly logo?: BusinessMedia;
  readonly media?: readonly BusinessMedia[];
  readonly verificationStatus: VerificationStatus;
  readonly verificationMethod: VerificationMethod | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly averageRating: number | null;
  readonly reviewCount: number;
}

export interface BusinessesView {
  readonly listings: readonly BusinessListing[];
}

export interface BusinessesPage {
  readonly listings: readonly BusinessListing[];
  readonly nextCursor: string | null;
}

export interface MyBusinessListingsPage {
  readonly listings: readonly BusinessListing[];
  readonly nextCursor: string | null;
}

export interface NewBusinessMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface ExistingBusinessMediaInput {
  readonly filename: string;
  readonly url: string;
}

export interface CreateBusinessListingInput {
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly address: string;
  readonly hours: string;
  readonly currentSpecial: string;
  readonly newLogo?: NewBusinessMediaInput;
  readonly newMedia?: readonly NewBusinessMediaInput[];
}

export interface UpdateBusinessListingInput {
  readonly listingId: string;
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly address: string;
  readonly hours: string;
  readonly currentSpecial: string;
  readonly existingLogo?: ExistingBusinessMediaInput;
  readonly newLogo?: NewBusinessMediaInput;
  readonly existingMedia?: readonly ExistingBusinessMediaInput[];
  readonly newMedia?: readonly NewBusinessMediaInput[];
}

const BUSINESSES_PAGE_SIZE = 20;

const businessesViewKey = (category: BusinessCategory | 'all') =>
  ['businesses', 'view', category] as const;
const businessDetailKey = (listingId: string) =>
  ['businesses', 'view', 'detail', listingId] as const;

const businessesPagePath = (
  category: BusinessCategory | undefined,
  cursor: string | null,
): `/${string}` =>
  `/api/business-listings?limit=${BUSINESSES_PAGE_SIZE}${
    category ? `&category=${encodeURIComponent(category)}` : ''
  }${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

// The main directory. Bounded and cursor-paginated on the server (see
// /api/business-listings) rather than loading every listing in one shot --
// callers that need a flat list should flatten `data.pages` themselves.
// Switching `category` re-keys the query and starts a fresh fetch.
export function useBusinessesView(category?: BusinessCategory) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: BusinessesPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<BusinessesPage>({
        getAccessToken: session.getToken,
        path: businessesPagePath(category, pageParam),
        signal,
      }),
    queryKey: businessesViewKey(category ?? 'all'),
  });
}

// A single listing by id, used by the listing detail screen -- the paginated
// directory no longer guarantees a given listing is already sitting in some
// cached page (or was ever fetched at all, for a deep link).
export function useBusinessListing(listingId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(listingId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly listing: BusinessListing }>({
        getAccessToken: session.getToken,
        path: `/api/business-listings/${listingId}`,
        signal,
      }),
    queryKey: businessDetailKey(listingId),
  });
}

const MY_BUSINESSES_PAGE_SIZE = 20;

// The activity hub — listings the caller created, server-scoped and
// paginated rather than filtered client-side from the full directory.
export function useMyBusinessListingsView() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MyBusinessListingsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MyBusinessListingsPage>({
        getAccessToken: session.getToken,
        path: `/api/business-listings/mine?limit=${MY_BUSINESSES_PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: ['businesses', 'mine', userId],
  });
}

export function useCreateBusinessListing() {
  const session = useSession();
  const queryClient = useQueryClient();
  const notifyXpAwarded = useNotifyXpAwarded();

  return useMutation({
    mutationFn: (input: CreateBusinessListingInput) =>
      requestJson<{ readonly listing: BusinessListing; readonly xpAward: XpAwardOutcome }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/business-listings',
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
      // Listing a business also grants a small amount of XP -- see
      // src/backend/xp -- which the profile's XP/level stat and the
      // points-history list and growth chart all need to pick up.
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'growth'] });
      notifyXpAwarded(result.xpAward);
    },
  });
}

export function useUpdateBusinessListing() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, ...body }: UpdateBusinessListingInput) =>
      requestJson<{ readonly listing: BusinessListing }>({
        body,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/business-listings/${listingId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}

export function useDeleteBusinessListing() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/business-listings/${listingId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}

export function useReportBusinessListing() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ listingId, ...submission }: { listingId: string } & ReportSubmission) =>
      requestJson<{ readonly reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/business-listings/${listingId}/report`,
      }),
  });
}
