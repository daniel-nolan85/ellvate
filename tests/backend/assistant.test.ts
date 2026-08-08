import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { POST as postAssistantChat } from '../../app/api/assistant/chat+api';
import {
  MAX_TOTAL_MESSAGE_TEXT_LENGTH,
  respondToChat,
  resetAssistantRateLimit,
  searchEvents,
  searchMissions,
  searchPosts,
  searchServices,
  validateChatMessages,
} from '../../src/backend/assistant';
import { createPost } from '../../src/backend/forum';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { resetStore } from '../../src/backend/store';

const ctx = memoryContext('demo-user');

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

afterAll(() => {
  if (originalAnthropicApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
  }
});

afterEach(() => {
  resetStore();
  resetAssistantRateLimit();
  resetWriteRateLimits();
});

const chatRequest = (body: unknown): Request =>
  new Request('http://localhost/api/assistant/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const userMessage = (text: string) => ({
  messages: [{ role: 'user', text }],
});

describe('local search', () => {
  test('searchEvents matches the mixer case-insensitively', async () => {
    const results = await searchEvents(ctx, 'MIXER');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'event-1',
      title: 'Locals Networking Mixer',
      place: 'MonteLago Village',
    });
  });

  test('searchEvents matches place and tag tokens', async () => {
    expect((await searchEvents(ctx, 'marina')).map((event) => event.id)).toEqual(
      ['event-3'],
    );
    expect(
      (await searchEvents(ctx, 'networking coffee')).map((event) => event.id),
    ).toEqual(['event-4', 'event-1']);
  });

  // searchX no longer falls back to "the first few items" when nothing
  // token-matches — see the WHY comment on rankByTokens in search.ts. An
  // unmatched query is a real "no results," not a guess dressed up as one.
  test('searchEvents returns nothing for an unmatched query', async () => {
    const results = await searchEvents(ctx, 'zzz-no-such-token');

    expect(results).toEqual([]);
  });

  test('searchMissions matches titles and descriptions', async () => {
    expect(
      (await searchMissions(ctx, 'trail loop')).map((mission) => mission.id),
    ).toEqual(['mission-2']);
    expect(
      (await searchMissions(ctx, 'sunrise')).map((mission) => mission.id),
    ).toEqual(['mission-1']);
  });

  test('searchPosts matches excerpts and forum names', async () => {
    expect((await searchPosts(ctx, 'kayak'))[0]).toMatchObject({
      id: 'post-1',
      title: 'Best spots to kayak at sunrise?',
      forum: 'Marina & Boating',
    });
    expect(
      (await searchPosts(ctx, 'dining patio')).map((post) => post.id),
    ).toEqual(['post-3']);
  });

  test('searchServices matches business name and category tokens', async () => {
    expect(
      (await searchServices(ctx, 'dog walking')).map((service) => service.id),
    ).toEqual(['service-1']);
    expect(
      (await searchServices(ctx, 'detailing')).map((service) => service.id),
    ).toEqual(['service-2']);
    expect((await searchServices(ctx, 'pool'))[0]).toMatchObject({
      id: 'service-3',
      businessName: 'Crystal Clear Pool Care',
      category: 'pool-spa',
    });
  });

  test('search returns at most 3 summaries', async () => {
    expect((await searchEvents(ctx, '')).length).toBeLessThanOrEqual(3);
    expect((await searchMissions(ctx, '')).length).toBeLessThanOrEqual(3);
    expect((await searchPosts(ctx, '')).length).toBeLessThanOrEqual(3);
    expect((await searchServices(ctx, '')).length).toBeLessThanOrEqual(3);
  });
});

describe('respondToChat fallback mode', () => {
  const fallback = (text: string) =>
    respondToChat(ctx, [{ role: 'user', text }], { apiKey: null });

  test('routes event keywords to search_events and cites real events', async () => {
    const reply = await fallback('What events are on this weekend?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
    ]);
    expect(reply.reply).toContain('Locals Networking Mixer');
    expect(reply.reply).toContain('MonteLago Village');
  });

  test('routes mission keywords to search_missions and cites real missions', async () => {
    const reply = await fallback('How do I earn xp on missions?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_missions', label: 'Searching missions…' },
    ]);
    expect(reply.reply).toContain('Sunrise at the Marina');
  });

  test('routes forum keywords to search_posts and cites real posts', async () => {
    const reply = await fallback('Any forum threads about kayak spots?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_posts', label: 'Searching posts…' },
    ]);
    expect(reply.reply).toContain('Best spots to kayak at sunrise?');
  });

  test('routes business keywords to search_services and cites real listings', async () => {
    const reply = await fallback('Do you know any pet care businesses?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_services', label: 'Searching local services…' },
    ]);
    expect(reply.reply).toContain('Lakeside Tails Dog Walking');
  });

  test('routes multi-topic questions to multiple tools in order', async () => {
    const reply = await fallback('Any events or missions this weekend?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
      { tool: 'search_missions', label: 'Searching missions…' },
    ]);
  });

  // Regression test for a bug where an unmatched query defaulted to
  // search_events, and a seeded event's place field ("MonteLago Village")
  // happened to token-match the query's "village", returning an unrelated
  // list of events instead of an honest "I don't know".
  test('gives an honest non-answer for a genuinely off-topic query instead of guessing', async () => {
    const reply = await fallback('Are there any ev chargers in the village?');

    expect(reply.toolCalls).toEqual([]);
    expect(reply.reply).not.toContain('Locals Networking Mixer');
  });

  test('gives an honest non-answer when no keywords match at all', async () => {
    const reply = await fallback('Hello there!');

    expect(reply.toolCalls).toEqual([]);
  });

  // Regression test: "near" was previously part of the search_missions
  // keyword route (to catch the "Missions near me" suggested prompt), causing
  // it to mis-route unrelated questions to missions results just because they
  // contained that one word. It's now a stop word for content search too
  // (see search.ts) — it was generic enough to also drag unrelated posts
  // ("near the village", "near the boat club") into otherwise-good answers,
  // so this query should come back with no matches at all.
  test('does not mis-route an off-topic query containing "near" to missions or posts', async () => {
    const reply = await fallback('Are there any ev chargers near the lake?');

    expect(reply.toolCalls).toEqual([]);
  });

  // Regression test for the real-world report that prompted this fix: the
  // user created a forum post about an EV charger and the assistant said it
  // didn't know anything about it. Root cause was the fallback keyword router
  // only ever calling search_posts for queries containing "post"/"forum"/etc
  // — a topic query with none of those words could never reach it, no matter
  // how directly the post's own content answered the question.
  test('finds a newly created forum post by topic, with no category keyword in the query', async () => {
    const created = await createPost(ctx, {
      title: 'New EV charger at the Hilton car park',
      excerpt: 'Just spotted a new EV charging station going in by the marina.',
      forum: 'Marina & Boating',
    });
    if (!created.ok) throw new Error('setup failed');

    const reply = await fallback('Do you know anything about EV charging stations?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_posts', label: 'Searching posts…' },
    ]);
    expect(reply.reply).toContain('New EV charger at the Hilton car park');
  });

  // Regression test: once the topic query above worked, the next report was
  // that adding "near" to the question (a very natural way to ask) dragged
  // in unrelated seeded posts ("near the village", "near the boat club")
  // alongside the real answer, because "near" alone was enough to score a
  // token match. It's a stop word now — the reply should cite only the post
  // that's actually about EV charging. Uses "tennis courts" rather than
  // "marina" for the location, since "marina" is itself common enough across
  // seed data (forum name, event place, mission description) to reintroduce
  // the same kind of over-matching this test is guarding against.
  test('does not pull in unrelated posts when the query includes "near"', async () => {
    const created = await createPost(ctx, {
      title: 'New EV charger installed at the Hilton',
      excerpt: 'Just spotted a new EV charging station going in near the tennis courts.',
      forum: 'Announcements',
    });
    if (!created.ok) throw new Error('setup failed');

    const reply = await fallback(
      'Are there any EV charging stations near the tennis courts?',
    );

    expect(reply.toolCalls).toEqual([
      { tool: 'search_posts', label: 'Searching posts…' },
    ]);
    expect(reply.reply).toContain('New EV charger installed at the Hilton');
    expect(reply.reply).not.toContain('kayak');
    expect(reply.reply).not.toContain('Loop trail');
  });

  test('uses the last user message when the thread ends with the assistant', async () => {
    const reply = await respondToChat(
      ctx,
      [
        { role: 'user', text: 'Any missions near me?' },
        { role: 'assistant', text: 'Let me check.' },
      ],
      { apiKey: null },
    );

    // "missions" names the category (browse fallback); "near" is a stop word
    // (see search.ts) so it no longer drags in unrelated posts that happen
    // to also say "near" somewhere.
    expect(reply.toolCalls).toEqual([
      { tool: 'search_missions', label: 'Searching missions…' },
    ]);
  });

  test('falls back to local search when ANTHROPIC_API_KEY is absent', async () => {
    const reply = await respondToChat(ctx, [
      { role: 'user', text: 'What events are happening?' },
    ]);

    expect(reply.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
    ]);
    expect(reply.reply.length).toBeGreaterThan(0);
  });
});

describe('POST /api/assistant/chat', () => {
  test('returns the AssistantReply shape for a valid request', async () => {
    const response = await postAssistantChat(
      chatRequest(userMessage('What events are on this weekend?')),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reply).toContain('Locals Networking Mixer');
    expect(body.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
    ]);
  });

  test('400s when messages is missing', async () => {
    const response = await postAssistantChat(chatRequest({}));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
  });

  test('400s when messages is empty', async () => {
    const response = await postAssistantChat(chatRequest({ messages: [] }));

    expect(response.status).toBe(400);
  });

  test('400s on an invalid role', async () => {
    const response = await postAssistantChat(
      chatRequest({ messages: [{ role: 'system', text: 'hi' }] }),
    );

    expect(response.status).toBe(400);
  });

  test('400s on non-string text', async () => {
    const response = await postAssistantChat(
      chatRequest({ messages: [{ role: 'user', text: 42 }] }),
    );

    expect(response.status).toBe(400);
  });

  test('400s when text exceeds 2000 characters', async () => {
    const response = await postAssistantChat(
      chatRequest({ messages: [{ role: 'user', text: 'x'.repeat(2001) }] }),
    );

    expect(response.status).toBe(400);
  });

  test('accepts text at exactly 2000 characters', async () => {
    const response = await postAssistantChat(
      chatRequest({ messages: [{ role: 'user', text: 'x'.repeat(2000) }] }),
    );

    expect(response.status).toBe(200);
  });

  test('rejects a conversation whose total text exceeds the request budget', () => {
    expect(
      validateChatMessages({
        messages: [
          { role: 'user', text: 'x'.repeat(MAX_TOTAL_MESSAGE_TEXT_LENGTH + 1) },
        ],
      }),
    ).toBeNull();
  });

  test('400s on a malformed JSON body', async () => {
    const response = await postAssistantChat(chatRequest('{not json'));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
  });

  test('429s after the per-user memory limit is exhausted', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(
        (await postAssistantChat(chatRequest(userMessage('events')))).status,
      ).toBe(200);
    }

    const response = await postAssistantChat(chatRequest(userMessage('events')));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('assistant_rate_limited');
  });
});
