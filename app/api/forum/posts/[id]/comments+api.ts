import { createComment, listComments } from '@/src/backend/comments';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ comments: await listComments(ctx, id) }),
  );
}

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
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
  });
}
