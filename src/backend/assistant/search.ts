import { getEventsView } from '@/src/backend/events';
import { listPosts } from '@/src/backend/forum';
import type { RequestContext } from '@/src/backend/http';
import { getMissionsView } from '@/src/backend/missions';
import { listPetitionsPage } from '@/src/backend/petitions';
import { getServicesView } from '@/src/backend/services';

export interface EventSummary {
  readonly id: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly dayLabel: string;
  readonly timeLabel: string;
  readonly going: number;
}

export interface MissionSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stopsTotal: number;
}

export interface PostSummary {
  readonly id: string;
  readonly title: string;
  readonly forum: string;
  readonly excerpt: string;
  readonly replies: number;
  readonly likes: number;
}

export interface ServiceSummary {
  readonly id: string;
  readonly businessName: string;
  readonly category: string;
  readonly description: string;
  readonly serviceArea: string | null;
  readonly hours: string | null;
  readonly averageRating: number | null;
}

export interface PetitionSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly signatureCount: number;
  readonly requiredSignatures: number;
}

const MAX_RESULTS = 3;
// Petitions are searched/browsed with a much larger fetch cap than the
// MAX_RESULTS=3 that other content types cap their *results* at -- this one
// caps the *candidate pool* fetched from listPetitionsPage before ranking,
// not the final answer size (rankByTokens/slice still trims to 3 after).
// Community-wide petitions are expected to stay a small list; 50 is a
// generous ceiling, not a real limit in practice.
const PETITIONS_FETCH_CAP = 50;
const MIN_TOKEN_LENGTH = 3;

// WHY: "lake" and "village" are excluded alongside ordinary stop words, not
// because they're grammatical filler, but because nearly every seeded event,
// mission, post, and listing mentions Lake Las Vegas or MonteLago Village
// somewhere — as the community's own name, they carry no discriminating
// power for content search and would token-match almost anything (e.g. "any
// ev chargers near the lake?" matching services and missions that have
// nothing to do with EV chargers, just because they also mention the lake).
// "near" is excluded for the same reason from the other direction: it's a
// generic relative-location word ("near the village", "near the boat club")
// that shows up incidentally in posts about completely unrelated topics, so
// a query using "near" would drag those posts into an otherwise-good answer
// alongside the one actually being asked about. "marina" is deliberately
// NOT on this list, even though it caused a similar-looking symptom during
// testing — unlike "lake"/"village" it's a genuine, searchable topic (marina
// events, boating), and stop-wording it would silently break a query that is
// actually about the marina (see the "searchEvents matches place and tag
// tokens" test, which relies on 'marina' finding the paddleboard meetup).
const STOP_WORDS: ReadonlySet<string> = new Set([
  'about',
  'all',
  'and',
  'any',
  'are',
  'can',
  'for',
  'how',
  'lake',
  'near',
  'the',
  'that',
  'this',
  'vegas',
  'village',
  'what',
  'when',
  'where',
  'with',
  'you',
]);

const tokenize = (query: string): readonly string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH)
    .filter((token) => !STOP_WORDS.has(token));

const scoreOf = (haystack: string, tokens: readonly string[]): number =>
  tokens.filter((token) => haystack.includes(token)).length;

// WHY: an unmatched query returns nothing — it used to fall back to the
// first few items unconditionally "to stay grounded in real data instead of
// a dead end," but that's exactly what made a seeded event's place field
// ("MonteLago Village") token-match an unrelated "village" query and get
// cited as if it were a real answer. The caller (respondWithLocalSearch) now
// owns the honest "I don't know" response when every search comes back
// empty, so a search function returning nothing here is the correct signal,
// not a gap to paper over.
function rankByTokens<T>(
  items: readonly T[],
  query: string,
  haystackOf: (item: T) => string,
): readonly T[] {
  const tokens = tokenize(query);
  const scored = items.map((item) => ({
    item,
    score: scoreOf(haystackOf(item).toLowerCase(), tokens),
  }));

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ item }) => item);
}

const toEventSummary = (event: {
  readonly id: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly dayLabel: string;
  readonly timeLabel: string;
  readonly going: number;
}): EventSummary => ({
  id: event.id,
  title: event.title,
  place: event.place,
  tag: event.tag,
  dayLabel: event.dayLabel,
  timeLabel: event.timeLabel,
  going: event.going,
});

const toMissionSummary = (mission: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stopsTotal: number;
}): MissionSummary => ({
  id: mission.id,
  title: mission.title,
  description: mission.description,
  stopsTotal: mission.stopsTotal,
});

const toPostSummary = (post: {
  readonly id: string;
  readonly title: string;
  readonly forum: string;
  readonly excerpt: string;
  readonly replies: number;
  readonly likes: number;
}): PostSummary => ({
  id: post.id,
  title: post.title,
  forum: post.forum,
  excerpt: post.excerpt,
  replies: post.replies,
  likes: post.likes,
});

const toPetitionSummary = (petition: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly signatureCount: number;
  readonly requiredSignatures: number;
}): PetitionSummary => ({
  category: petition.category,
  description: petition.description,
  id: petition.id,
  requiredSignatures: petition.requiredSignatures,
  signatureCount: petition.signatureCount,
  title: petition.title,
});

const toServiceSummary = (listing: {
  readonly id: string;
  readonly businessName: string;
  readonly category: string;
  readonly description: string;
  readonly serviceArea: string | null;
  readonly hours: string | null;
  readonly averageRating: number | null;
}): ServiceSummary => ({
  id: listing.id,
  businessName: listing.businessName,
  category: listing.category,
  description: listing.description,
  serviceArea: listing.serviceArea,
  hours: listing.hours,
  averageRating: listing.averageRating,
});

// The assistant reads the same live data the screens do (Supabase when
// configured, the in-memory store otherwise), so it never cites content that is
// not actually in the app. On an empty shell it truthfully finds nothing.
export async function searchEvents(
  ctx: RequestContext,
  query: string,
): Promise<readonly EventSummary[]> {
  const { events } = await getEventsView(ctx);
  return rankByTokens(
    events,
    query,
    (event) => `${event.title} ${event.place} ${event.tag}`,
  ).map(toEventSummary);
}

export async function searchMissions(
  ctx: RequestContext,
  query: string,
): Promise<readonly MissionSummary[]> {
  const { missions } = await getMissionsView(ctx);
  return rankByTokens(
    missions,
    query,
    (mission) => `${mission.title} ${mission.description}`,
  ).map(toMissionSummary);
}

export async function searchPosts(
  ctx: RequestContext,
  query: string,
): Promise<readonly PostSummary[]> {
  const posts = await listPosts(ctx);
  return rankByTokens(
    posts,
    query,
    (post) => `${post.title} ${post.excerpt} ${post.forum}`,
  ).map(toPostSummary);
}

// Only 'open' petitions -- the ones someone could still act on by signing --
// mirrors getEventsView filtering to upcoming-only rather than every event
// ever created.
export async function searchPetitions(
  ctx: RequestContext,
  query: string,
): Promise<readonly PetitionSummary[]> {
  const { petitions } = await listPetitionsPage(ctx, {
    limit: PETITIONS_FETCH_CAP,
    status: 'open',
  });
  return rankByTokens(
    petitions,
    query,
    (petition) => `${petition.title} ${petition.description} ${petition.category}`,
  ).map(toPetitionSummary);
}

export async function searchServices(
  ctx: RequestContext,
  query: string,
): Promise<readonly ServiceSummary[]> {
  const { listings } = await getServicesView(ctx);
  return rankByTokens(
    listings,
    query,
    (listing) =>
      `${listing.businessName} ${listing.category} ${listing.description} ${listing.serviceArea ?? ''}`,
  ).map(toServiceSummary);
}

// WHY: distinct from searchX — used only by the local-search fallback's
// "browse" path, when the user's message explicitly names a category (e.g.
// "any events this weekend?") but nothing in the current data literally
// token-matches their wording. Showing what's currently there is a
// reasonable answer to a category-level question; searchX intentionally does
// NOT do this itself since a real tool call (from the Anthropic path, or a
// content-topic query with no named category) should never get back
// unrelated items dressed up as a match.
export async function browseEvents(
  ctx: RequestContext,
): Promise<readonly EventSummary[]> {
  const { events } = await getEventsView(ctx);
  return events.slice(0, MAX_RESULTS).map(toEventSummary);
}

export async function browseMissions(
  ctx: RequestContext,
): Promise<readonly MissionSummary[]> {
  const { missions } = await getMissionsView(ctx);
  return missions.slice(0, MAX_RESULTS).map(toMissionSummary);
}

export async function browsePosts(
  ctx: RequestContext,
): Promise<readonly PostSummary[]> {
  const posts = await listPosts(ctx);
  return posts.slice(0, MAX_RESULTS).map(toPostSummary);
}

export async function browsePetitions(
  ctx: RequestContext,
): Promise<readonly PetitionSummary[]> {
  const { petitions } = await listPetitionsPage(ctx, { limit: MAX_RESULTS, status: 'open' });
  return petitions.map(toPetitionSummary);
}

export async function browseServices(
  ctx: RequestContext,
): Promise<readonly ServiceSummary[]> {
  const { listings } = await getServicesView(ctx);
  return listings.slice(0, MAX_RESULTS).map(toServiceSummary);
}
