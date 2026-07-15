import { createPost, listPosts } from '@/src/backend/forum';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const forum = new URL(request.url).searchParams.get('forum') ?? undefined;
    return jsonOk({ posts: await listPosts(ctx, forum) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await createPost(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ post: result.post }, { status: 201 });
  });
}
