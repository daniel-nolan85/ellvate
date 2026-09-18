import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type ServiceCategory =
  | 'pet-care'
  | 'home-services'
  | 'beauty'
  | 'automotive'
  | 'pool-spa'
  | 'tech-web'
  | 'dining'
  | 'other';

export interface ServiceMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface ServiceListing {
  readonly id: string;
  readonly author: PersonRef;
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly serviceArea: string | null;
  readonly hours: string | null;
  readonly logo?: ServiceMedia;
  readonly media?: readonly ServiceMedia[];
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly averageRating: number | null;
  readonly reviewCount: number;
}

export interface ServicesView {
  readonly listings: readonly ServiceListing[];
}

export interface ServicesPage {
  readonly listings: readonly ServiceListing[];
  readonly nextCursor: string | null;
}

export interface MyServiceListingsPage {
  readonly listings: readonly ServiceListing[];
  readonly nextCursor: string | null;
}

export interface NewServiceMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface ExistingServiceMediaInput {
  readonly filename: string;
  readonly url: string;
}

export interface CreateServiceListingInput {
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly serviceArea: string;
  readonly hours: string;
  readonly newLogo?: NewServiceMediaInput;
  readonly newMedia?: readonly NewServiceMediaInput[];
}

export interface UpdateServiceListingInput {
  readonly listingId: string;
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly serviceArea: string;
  readonly hours: string;
  readonly existingLogo?: ExistingServiceMediaInput;
  readonly newLogo?: NewServiceMediaInput;
  readonly existingMedia?: readonly ExistingServiceMediaInput[];
  readonly newMedia?: readonly NewServiceMediaInput[];
}

const SERVICES_PAGE_SIZE = 20;

const servicesViewKey = (category: ServiceCategory | 'all') =>
  ['services', 'view', category] as const;
const serviceDetailKey = (listingId: string) =>
  ['services', 'view', 'detail', listingId] as const;

const servicesPagePath = (
  category: ServiceCategory | undefined,
  cursor: string | null,
): `/${string}` =>
  `/api/services?limit=${SERVICES_PAGE_SIZE}${
    category ? `&category=${encodeURIComponent(category)}` : ''
  }${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

// The main directory. Bounded and cursor-paginated on the server (see
// /api/services) rather than loading every listing in one shot -- callers
// that need a flat list should flatten `data.pages` themselves. Switching
// `category` re-keys the query and starts a fresh fetch.
export function useServicesView(category?: ServiceCategory) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: ServicesPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<ServicesPage>({
        getAccessToken: session.getToken,
        path: servicesPagePath(category, pageParam),
        signal,
      }),
    queryKey: servicesViewKey(category ?? 'all'),
  });
}

// A single listing by id, used by the listing detail screen -- the paginated
// directory no longer guarantees a given listing is already sitting in some
// cached page (or was ever fetched at all, for a deep link).
export function useServiceListing(listingId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(listingId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly listing: ServiceListing }>({
        getAccessToken: session.getToken,
        path: `/api/services/${listingId}`,
        signal,
      }),
    queryKey: serviceDetailKey(listingId),
  });
}

const MY_SERVICES_PAGE_SIZE = 20;

// The activity hub — listings the caller created, server-scoped and
// paginated rather than filtered client-side from the full directory.
export function useMyServiceListingsView() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MyServiceListingsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MyServiceListingsPage>({
        getAccessToken: session.getToken,
        path: `/api/services/mine?limit=${MY_SERVICES_PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: ['services', 'mine', userId],
  });
}

export function useCreateServiceListing() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateServiceListingInput) =>
      requestJson<{ readonly listing: ServiceListing }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/services',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      // Listing a service also grants a small amount of XP -- see
      // src/backend/xp -- which the profile's XP/level stat and the
      // points-history list and growth chart all need to pick up.
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'growth'] });
    },
  });
}

export function useUpdateServiceListing() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, ...body }: UpdateServiceListingInput) =>
      requestJson<{ readonly listing: ServiceListing }>({
        body,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/services/${listingId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeleteServiceListing() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/services/${listingId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
