import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { POST as postAssistantChat } from '../../app/api/assistant/chat+api';
import {
  respondToChat,
  searchEvents,
  searchMissions,
  searchPosts,
} from '../../src/backend/assistant';
import { resetStore } from '../../src/backend/store';

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
  test('searchEvents matches the mixer case-insensitively', () => {
    const results = searchEvents('MIXER');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'event-1',
      title: 'Locals Networking Mixer',
      place: 'MonteLago Village',
    });
  });

  test('searchEvents matches place and tag tokens', () => {
    expect(searchEvents('marina').map((event) => event.id)).toEqual([
      'event-3',
    ]);
    expect(
      searchEvents('networking coffee').map((event) => event.id),
    ).toEqual(['event-4', 'event-1']);
  });

  test('searchEvents caps unmatched queries at the top 3 seeded events', () => {
    const results = searchEvents('zzz-no-such-token');

    expect(results.map((event) => event.id)).toEqual([
      'event-1',
      'event-2',
      'event-3',
    ]);
  });

  test('searchMissions matches titles and descriptions', () => {
    expect(searchMissions('trail loop').map((mission) => mission.id)).toEqual([
      'mission-2',
    ]);
    expect(searchMissions('sunrise').map((mission) => mission.id)).toEqual([
      'mission-1',
    ]);
  });

  test('searchPosts matches excerpts and forum names', () => {
    expect(searchPosts('kayak')[0]).toMatchObject({
      id: 'post-1',
      title: 'Best spots to kayak at sunrise?',
      forum: 'Marina & Boating',
    });
    expect(searchPosts('dining patio').map((post) => post.id)).toEqual([
      'post-3',
    ]);
  });

  test('search returns at most 3 summaries', () => {
    expect(searchEvents('').length).toBeLessThanOrEqual(3);
    expect(searchMissions('').length).toBeLessThanOrEqual(3);
    expect(searchPosts('').length).toBeLessThanOrEqual(3);
  });
});

describe('respondToChat fallback mode', () => {
  const fallback = (text: string) =>
    respondToChat('demo-user', [{ role: 'user', text }], { apiKey: null });

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

  test('routes multi-topic questions to multiple tools in order', async () => {
    const reply = await fallback('Any events or missions this weekend?');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
      { tool: 'search_missions', label: 'Searching missions…' },
    ]);
  });

  test('defaults to search_events when no keywords match', async () => {
    const reply = await fallback('Hello there!');

    expect(reply.toolCalls).toEqual([
      { tool: 'search_events', label: 'Searching events…' },
    ]);
    expect(reply.reply).toContain('Locals Networking Mixer');
  });

  test('uses the last user message when the thread ends with the assistant', async () => {
    const reply = await respondToChat(
      'demo-user',
      [
        { role: 'user', text: 'Any missions near me?' },
        { role: 'assistant', text: 'Let me check.' },
      ],
      { apiKey: null },
    );

    expect(reply.toolCalls).toEqual([
      { tool: 'search_missions', label: 'Searching missions…' },
    ]);
  });

  test('falls back to local search when ANTHROPIC_API_KEY is absent', async () => {
    const reply = await respondToChat('demo-user', [
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

  test('400s on a malformed JSON body', async () => {
    const response = await postAssistantChat(chatRequest('{not json'));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
  });
});
