import { createPost, listPosts } from '@/src/backend/forum';
import { getRequestUserId, jsonError, jsonOk } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  const forum = new URL(request.url).searchParams.get('forum') ?? undefined;

  return jsonOk({ posts: listPosts(userId, forum) });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  const body: unknown = await request.json().catch(() => null);
  const result = createPost(userId, body);

  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }

  return jsonOk({ post: result.post }, { status: 201 });
}
