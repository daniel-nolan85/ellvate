import { getState } from '@/src/backend/store';

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
  readonly xp: number;
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

const MAX_RESULTS = 3;
const MIN_TOKEN_LENGTH = 3;

const STOP_WORDS: ReadonlySet<string> = new Set([
  'about',
  'all',
  'and',
  'any',
  'are',
  'can',
  'for',
  'how',
  'the',
  'that',
  'this',
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

// WHY: an empty or fully-unmatched query still returns the first few items so
// replies stay grounded in real store data instead of "no results" dead ends.
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
  const matched = scored.filter(({ score }) => score > 0);

  if (matched.length === 0) {
    return items.slice(0, MAX_RESULTS);
  }

  return [...matched]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ item }) => item);
}

export function searchEvents(query: string): readonly EventSummary[] {
  return rankByTokens(
    getState().events,
    query,
    (event) => `${event.title} ${event.place} ${event.tag}`,
  ).map((event) => ({
    id: event.id,
    title: event.title,
    place: event.place,
    tag: event.tag,
    dayLabel: event.dayLabel,
    timeLabel: event.timeLabel,
    going: event.going,
  }));
}

export function searchMissions(query: string): readonly MissionSummary[] {
  return rankByTokens(
    getState().missions,
    query,
    (mission) => `${mission.title} ${mission.description}`,
  ).map((mission) => ({
    id: mission.id,
    title: mission.title,
    description: mission.description,
    xp: mission.xp,
    stopsTotal: mission.stopsTotal,
  }));
}

export function searchPosts(query: string): readonly PostSummary[] {
  return rankByTokens(
    getState().posts,
    query,
    (post) => `${post.title} ${post.excerpt} ${post.forum}`,
  ).map((post) => ({
    id: post.id,
    title: post.title,
    forum: post.forum,
    excerpt: post.excerpt,
    replies: post.replies,
    likes: post.likes,
  }));
}
