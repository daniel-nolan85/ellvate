import { afterEach, describe, expect, test } from 'bun:test';

import { POST as postReportMember } from '../../app/api/users/[userId]/report+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { reportMember } from '../../src/backend/member-reports';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('reportMember', () => {
  test('reports an existing member', async () => {
    const result = await reportMember(ctx(), 'user-jordan');

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().memberReports.some(
        (report) =>
          report.reportedUserId === 'user-jordan' && report.reporterId === DEMO_USER_ID,
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same member twice records one report', async () => {
    await reportMember(ctx(), 'user-jordan');
    await reportMember(ctx(), 'user-jordan');

    expect(
      getState().memberReports.filter(
        (report) =>
          report.reportedUserId === 'user-jordan' && report.reporterId === DEMO_USER_ID,
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting yourself', async () => {
    const result = await reportMember(ctx(DEMO_USER_ID), DEMO_USER_ID);

    expect(result).toMatchObject({ code: 'cannot_report_self', ok: false });
    expect(getState().memberReports).toEqual([]);
  });

  test('rejects reporting an unknown member', async () => {
    const result = await reportMember(ctx(), 'user-does-not-exist');

    expect(result).toMatchObject({ code: 'member_not_found', ok: false });
  });

  test('two different reporters can each report the same member', async () => {
    await reportMember(ctx(DEMO_USER_ID), 'user-jordan');
    await reportMember(ctx('user-mia'), 'user-jordan');

    expect(
      getState().memberReports.filter((report) => report.reportedUserId === 'user-jordan'),
    ).toHaveLength(2);
  });
});

describe('member report route', () => {
  test('POST /api/users/[userId]/report round-trips through the route', async () => {
    const response = await postReportMember(
      new Request('http://test/report', { method: 'POST' }),
      { userId: 'user-jordan' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reported: true });
  });

  test('POST rejects reporting yourself with 400', async () => {
    const response = await postReportMember(
      new Request('http://test/report', { method: 'POST' }),
      { userId: DEMO_USER_ID },
    );
    expect(response.status).toBe(400);
  });

  test('POST returns 404 for an unknown member', async () => {
    const response = await postReportMember(
      new Request('http://test/report', { method: 'POST' }),
      { userId: 'user-does-not-exist' },
    );
    expect(response.status).toBe(404);
  });
});
