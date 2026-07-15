import { describe, expect, test } from 'bun:test';

import { parseCommentsResponse } from './comment-contract';

describe('parseCommentsResponse', () => {
  test('accepts the complete comment contract', () => {
    expect(
      parseCommentsResponse({
        comments: [
          {
            author: { id: 'user-1', name: 'Lake Neighbor' },
            body: 'See you at the marina.',
            createdAt: '2026-07-14T08:00:00.000Z',
            id: 'comment-1',
            postId: 'post-1',
          },
        ],
      }),
    ).toEqual({
      comments: [
        {
          author: { id: 'user-1', name: 'Lake Neighbor' },
          body: 'See you at the marina.',
          createdAt: '2026-07-14T08:00:00.000Z',
          id: 'comment-1',
          postId: 'post-1',
        },
      ],
    });
  });

  test('rejects malformed rows before the renderer receives them', () => {
    expect(() =>
      parseCommentsResponse({
        comments: [{ body: 'Missing its author and identifiers.' }],
      }),
    ).toThrow('comments[0].author is missing');
  });

  test('rejects a non-array comments payload', () => {
    expect(() => parseCommentsResponse({ comments: {} })).toThrow(
      'comments must be an array',
    );
  });
});
