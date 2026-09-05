import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import type { DeletableTable } from '../app/(dashboard)/actions';
import { escapeOrSearchTerm, LIST_PAGE_SIZE } from './pagination';

// Reports merge 10 separate tables. A fully keyset-paginated merge across all
// 10 (independently tracking each table's cursor position) is real complexity
// for an internal moderation queue with a small row count -- offset
// pagination is simpler to build and maintain, and the classic downside (a
// row shifting page as new reports arrive between loads) is a non-issue at
// this scale.
const FETCH_CAP = 300;

export interface ReportRow {
  readonly id: string;
  readonly type: string;
  readonly snippet: string;
  readonly photoUrl: string | null;
  readonly detailHref: string | null;
  readonly reporter: string;
  readonly created_at: string;
  readonly deleteTable: DeletableTable;
  readonly deleteId: string;
  // Null on reports filed before this feature (migration
  // 0053_report_reasons_and_evidence.sql) -- shown as "No reason given"
  // rather than a fabricated default.
  readonly reason: string | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface ReportsResult {
  readonly rows: readonly ReportRow[];
  readonly total: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export async function loadReports(
  query: string,
  page: number,
  adminEmail: string | null,
): Promise<ReportsResult> {
  const admin = createSupabaseAdminClient();
  const term = query ? `%${escapeOrSearchTerm(query)}%` : null;
  const withReporterFilter = <Q extends { ilike(column: string, pattern: string): Q }>(
    q: Q,
  ): Q => (term ? q.ilike('reporter.name', term) : q);

  // Marking "seen" rides along in the same Promise.all as the page's own
  // queries rather than blocking the render on a separate round trip --
  // the nav badge (computed independently in layout.tsx) may or may not
  // already read 0 on this exact page view, but every subsequent visit
  // will, which is the only guarantee that actually matters here.
  const markSeen = adminEmail
    ? admin
        .from('dashboard_admins')
        .update({ reports_last_seen_at: new Date().toISOString() })
        .eq('email', adminEmail)
    : Promise.resolve();

  const [
    ,
    postReports,
    commentReports,
    eventReports,
    eventCommentReports,
    missionReports,
    missionCommentReports,
    serviceReviewReports,
    checkInReports,
    petitionReports,
    petitionCommentReports,
    memberReports,
  ] = await Promise.all([
    markSeen,
    withReporterFilter(
      admin
        .from('post_reports')
        .select(
          'id, post_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), post:posts(title)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('comment_reports')
        .select(
          'id, comment_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), comment:comments(body)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('event_reports')
        .select(
          'id, event_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), event:events(title)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('event_comment_reports')
        .select(
          'id, event_comment_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), event_comment:event_comments(body)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('mission_reports')
        .select(
          'id, mission_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), mission:missions(title)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('mission_comment_reports')
        .select(
          'id, mission_comment_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), mission_comment:mission_comments(body)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('service_review_reports')
        .select(
          'id, service_review_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), service_review:service_reviews(body, rating)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('mission_check_in_reports')
        .select(
          'id, check_in_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), check_in:mission_check_ins(stop_index, photo_url)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('petition_reports')
        .select(
          'id, petition_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), petition:petitions(title)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('petition_comment_reports')
        .select(
          'id, petition_comment_id, created_at, reason, details, evidence_image_url, reporter:app_users!inner(name), petition_comment:petition_comments(body)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
    withReporterFilter(
      admin
        .from('member_reports')
        .select(
          'id, reported_user_id, created_at, reason, details, evidence_image_url, reporter:app_users!member_reports_reporter_id_fkey!inner(name), reported:app_users!member_reports_reported_user_id_fkey(name)',
        ),
    )
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP),
  ]);

  for (const result of [
    postReports,
    commentReports,
    eventReports,
    eventCommentReports,
    missionReports,
    missionCommentReports,
    serviceReviewReports,
    checkInReports,
    petitionReports,
    petitionCommentReports,
    memberReports,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const rows: ReportRow[] = [];

  for (const r of (postReports.data ?? []) as unknown as readonly {
    id: string;
    post_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    post: { title: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Post',
      snippet: r.post?.title ?? 'Unknown post',
      photoUrl: null,
      detailHref: `/posts/${r.post_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'posts',
      deleteId: r.post_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (commentReports.data ?? []) as unknown as readonly {
    id: string;
    comment_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    comment: { body: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Forum comment',
      snippet: r.comment?.body ?? 'Unknown comment',
      photoUrl: null,
      detailHref: `/comments/forum/${r.comment_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'comments',
      deleteId: r.comment_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (eventReports.data ?? []) as unknown as readonly {
    id: string;
    event_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    event: { title: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Event',
      snippet: r.event?.title ?? 'Unknown event',
      photoUrl: null,
      detailHref: `/events/${r.event_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'events',
      deleteId: r.event_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (eventCommentReports.data ?? []) as unknown as readonly {
    id: string;
    event_comment_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    event_comment: { body: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Event comment',
      snippet: r.event_comment?.body ?? 'Unknown comment',
      photoUrl: null,
      detailHref: `/comments/event/${r.event_comment_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'event_comments',
      deleteId: r.event_comment_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (missionReports.data ?? []) as unknown as readonly {
    id: string;
    mission_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    mission: { title: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Mission',
      snippet: r.mission?.title ?? 'Unknown mission',
      photoUrl: null,
      detailHref: `/missions/${r.mission_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'missions',
      deleteId: r.mission_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (missionCommentReports.data ?? []) as unknown as readonly {
    id: string;
    mission_comment_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    mission_comment: { body: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Mission comment',
      snippet: r.mission_comment?.body ?? 'Unknown comment',
      photoUrl: null,
      detailHref: `/comments/mission/${r.mission_comment_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'mission_comments',
      deleteId: r.mission_comment_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (serviceReviewReports.data ?? []) as unknown as readonly {
    id: string;
    service_review_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    service_review: { body: string | null; rating: number } | null;
  }[]) {
    const review = r.service_review;
    const snippet = review
      ? review.body
        ? `${'★'.repeat(review.rating)} — ${review.body}`
        : '★'.repeat(review.rating)
      : 'Unknown review';
    rows.push({
      id: r.id,
      type: 'Service review',
      snippet,
      photoUrl: null,
      detailHref: `/comments/service-review/${r.service_review_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'service_reviews',
      deleteId: r.service_review_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (checkInReports.data ?? []) as unknown as readonly {
    id: string;
    check_in_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    check_in: { stop_index: number; photo_url: string | null } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Mission check-in photo',
      snippet: r.check_in ? `Stop ${r.check_in.stop_index + 1} check-in` : 'Unknown check-in',
      photoUrl: r.check_in?.photo_url ?? null,
      detailHref: `/mission-check-ins/${r.check_in_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'mission_check_ins',
      deleteId: r.check_in_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (petitionReports.data ?? []) as unknown as readonly {
    id: string;
    petition_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    petition: { title: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Petition',
      snippet: r.petition?.title ?? 'Unknown petition',
      photoUrl: null,
      detailHref: `/petitions/${r.petition_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'petitions',
      deleteId: r.petition_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (petitionCommentReports.data ?? []) as unknown as readonly {
    id: string;
    petition_comment_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    petition_comment: { body: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Petition comment',
      snippet: r.petition_comment?.body ?? 'Unknown comment',
      photoUrl: null,
      detailHref: `/comments/petition/${r.petition_comment_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'petition_comments',
      deleteId: r.petition_comment_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  for (const r of (memberReports.data ?? []) as unknown as readonly {
    id: string;
    reported_user_id: string;
    created_at: string;
    reason: string | null;
    details: string | null;
    evidence_image_url: string | null;
    reporter: { name: string } | null;
    reported: { name: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      type: 'Member',
      snippet: r.reported?.name ?? 'Unknown member',
      photoUrl: null,
      detailHref: `/users/${r.reported_user_id}`,
      reporter: r.reporter?.name ?? 'Unknown',
      created_at: r.created_at,
      deleteTable: 'app_users',
      deleteId: r.reported_user_id,
      reason: r.reason,
      details: r.details,
      evidenceImageUrl: r.evidence_image_url,
    });
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = rows.length;
  const offset = (page - 1) * LIST_PAGE_SIZE;
  return {
    rows: rows.slice(offset, offset + LIST_PAGE_SIZE),
    total,
    hasNext: offset + LIST_PAGE_SIZE < total,
    hasPrev: page > 1,
  };
}
