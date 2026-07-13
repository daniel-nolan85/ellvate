import { createComment, listComments } from '@/src/backend/comments';
import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk({ comments: await listComments(ctx, id) });
}

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const ctx = await createRequestContext(request);
  const body: unknown = await request.json().catch(() => null);
  const result = await createComment(ctx, id, body);

  if (!result.ok) {
    return jsonError(
      result.code === 'post_not_found' ? 404 : 400,
      result.code,
      result.message,
    );
  }
  return jsonOk({ comment: result.comment }, { status: 201 });
}
