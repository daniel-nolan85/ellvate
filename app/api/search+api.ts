import { jsonOk, withRequestContext } from '@/src/backend/http';
import { MIN_SEARCH_QUERY_LENGTH, searchAll, type GlobalSearchResults } from '@/src/backend/search';

const EMPTY_RESULTS: GlobalSearchResults = {
  businesses: [],
  events: [],
  missions: [],
  petitions: [],
  posts: [],
  services: [],
};

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') ?? '').trim();
    if (query.length < MIN_SEARCH_QUERY_LENGTH) {
      return jsonOk(EMPTY_RESULTS);
    }
    const results = await searchAll(ctx, query);
    return jsonOk(results);
  });
}
