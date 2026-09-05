import { afterEach, describe, expect, test } from 'bun:test';

import {
  DELETE as deleteRoute,
  PATCH as patchRoute,
} from '../../app/api/petition-comments/[id]/index+api';
import { POST as reportRoute } from '../../app/api/petition-comments/[id]/report+api';
import {
  GET as getComments,
  POST as postComment,
} from '../../app/api/petitions/[id]/comments+api';
import {
  createPetitionComment,
  deletePetitionComment,
  listPetitionComments,
  listPetitionCommentsPage,
  reportPetitionComment,
  updatePetitionComment,
} from '../../src/backend/petition-comments';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { toggleMute } from '../../src/backend/mutes';
import type { ValidReportSubmission } from '@/src/backend/reports';
import { DEMO_USER_ID, getState, resetStore, setState } from '../../src/backend/store';
import type { StoredPetition } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);
const TEST_REPORT_SUBMISSION: ValidReportSubmission = {
  details: null,
  evidenceImageDataUrl: null,
  reason: 'other',
};

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

function seedPetition(overrides: Partial<StoredPetition> = {}): StoredPetition {
  const stored: StoredPetition = {
    category: 'safety',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: DEMO_USER_ID,
    deadlineAt: '2026-12-31T00:00:00.000Z',
    deadlineDays: 30,
    description: 'A description of the issue.',
    hoaEmailSentAt: null,
    hoaResponse: null,
    hoaResponseAt: null,
    id: `fixture-petition-${Math.random().toString(36).slice(2)}`,
    requiredSignatures: 200,
    signatureCount: 0,
    status: 'open',
    succeededAt: null,
    title: 'Fixture petition',
    ...overrides,
  };
  setState((current) => ({ ...current, petitions: [...current.petitions, stored] }));
  return stored;
}

describe('createPetitionComment', () => {
  // Regression test for the feature request that removed the earlier
  // "comments only after a petition succeeds" restriction -- comments must
  // work on an 'open' petition too, not just 'succeeded' ones.
  test('works on an open petition, not just a succeeded one', async () => {
    const petition = seedPetition({ status: 'open' });

    const result = await createPetitionComment(ctx(), petition.id, {
      body: 'Fully support this.',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comment.body).toBe('Fully support this.');
      expect(result.comment.petitionId).toBe(petition.id);
    }
  });

  test('rejects an empty body', async () => {
    const petition = seedPetition();
    const result = await createPetitionComment(ctx(), petition.id, { body: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_comment');
    }
  });

  test('returns petition_not_found for an unknown petition', async () => {
    const result = await createPetitionComment(ctx(), 'does-not-exist', { body: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('petition_not_found');
    }
  });

  test('POST /api/petitions/[id]/comments round-trips through the route', async () => {
    const petition = seedPetition();
    const response = await postComment(
      new Request('http://test/comments', {
        body: JSON.stringify({ body: 'Great idea.' }),
        method: 'POST',
      }),
      { id: petition.id },
    );
    expect(response.status).toBe(201);
  });
});

describe('listPetitionComments / listPetitionCommentsPage', () => {
  test('returns comments oldest-first', async () => {
    const petition = seedPetition();
    await createPetitionComment(ctx(), petition.id, { body: 'first' });
    await createPetitionComment(ctx('user-mia'), petition.id, { body: 'second' });

    const comments = await listPetitionComments(ctx(), petition.id);
    expect(comments.map((comment) => comment.body)).toEqual(['first', 'second']);
  });

  test('GET /api/petitions/[id]/comments returns a page', async () => {
    const petition = seedPetition();
    await createPetitionComment(ctx(), petition.id, { body: 'only one' });

    const response = await getComments(new Request('http://test/comments'), { id: petition.id });
    const body = (await response.json()) as { comments: readonly { body: string }[] };
    expect(body.comments.map((c) => c.body)).toEqual(['only one']);
  });

  test('listPetitionCommentsPage paginates and preserves oldest-first order', async () => {
    const petition = seedPetition();
    setState((current) => ({
      ...current,
      petitionComments: [
        ...current.petitionComments,
        {
          authorId: DEMO_USER_ID,
          body: 'first',
          createdAt: '2026-01-01T00:00:00.000Z',
          editedAt: null,
          id: 'pc-1',
          petitionId: petition.id,
        },
        {
          authorId: DEMO_USER_ID,
          body: 'second',
          createdAt: '2026-01-02T00:00:00.000Z',
          editedAt: null,
          id: 'pc-2',
          petitionId: petition.id,
        },
      ],
    }));

    const firstPage = await listPetitionCommentsPage(ctx(), petition.id, { limit: 1 });
    expect(firstPage.comments.map((c) => c.id)).toEqual(['pc-1']);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listPetitionCommentsPage(ctx(), petition.id, {
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
    });
    expect(secondPage.comments.map((c) => c.id)).toEqual(['pc-2']);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('excludes comments from a muted author', async () => {
    const petition = seedPetition();
    await createPetitionComment(ctx('user-mia'), petition.id, { body: 'muted comment' });
    await toggleMute(ctx(), 'user-mia');

    const page = await listPetitionCommentsPage(ctx(), petition.id);
    expect(page.comments.map((c) => c.body)).not.toContain('muted comment');
  });
});

describe('updatePetitionComment', () => {
  test('lets the author edit their own comment and stamps editedAt', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'original' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updatePetitionComment(ctx(), created.comment.id, { body: 'edited' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comment.body).toBe('edited');
      expect(result.comment.editedAt).not.toBeNull();
    }
  });

  test('forbids editing someone else’s comment', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'original' });
    if (!created.ok) throw new Error('setup failed');

    const result = await updatePetitionComment(ctx('user-mia'), created.comment.id, {
      body: 'hijacked',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('forbidden');
    }
  });

  test('PATCH /api/petition-comments/[id] round-trips through the route', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'original' });
    if (!created.ok) throw new Error('setup failed');

    const response = await patchRoute(
      new Request('http://test/x', {
        body: JSON.stringify({ body: 'updated via route' }),
        method: 'PATCH',
      }),
      { id: created.comment.id },
    );
    expect(response.status).toBe(200);
  });
});

describe('deletePetitionComment', () => {
  test('only the author can delete their comment', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'to delete' });
    if (!created.ok) throw new Error('setup failed');

    expect(await deletePetitionComment(ctx('user-mia'), created.comment.id)).toBe(false);
    expect(await deletePetitionComment(ctx(DEMO_USER_ID), created.comment.id)).toBe(true);
    expect(getState().petitionComments.some((c) => c.id === created.comment.id)).toBe(false);
  });

  test('DELETE /api/petition-comments/[id] round-trips through the route', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'to delete' });
    if (!created.ok) throw new Error('setup failed');

    const response = await deleteRoute(new Request('http://test/x', { method: 'DELETE' }), {
      id: created.comment.id,
    });
    expect(response.status).toBe(200);
  });
});

describe('reportPetitionComment', () => {
  test('is idempotent -- reporting twice records one report', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'reported' });
    if (!created.ok) throw new Error('setup failed');

    await reportPetitionComment(ctx('user-mia'), created.comment.id, TEST_REPORT_SUBMISSION);
    await reportPetitionComment(ctx('user-mia'), created.comment.id, TEST_REPORT_SUBMISSION);

    expect(
      getState().petitionCommentReports.filter(
        (report) => report.petitionCommentId === created.comment.id,
      ),
    ).toHaveLength(1);
  });

  test('POST /api/petition-comments/[id]/report round-trips through the route', async () => {
    const petition = seedPetition();
    const created = await createPetitionComment(ctx(), petition.id, { body: 'reported' });
    if (!created.ok) throw new Error('setup failed');

    const response = await reportRoute(
      new Request('http://test/x', {
        body: JSON.stringify({ reason: 'other' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      { id: created.comment.id },
    );
    expect(response.status).toBe(200);
  });
});
