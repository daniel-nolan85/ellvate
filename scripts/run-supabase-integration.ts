import { strict as assert } from 'node:assert';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_USER_A_ID',
  'SUPABASE_TEST_USER_A_TOKEN',
  'SUPABASE_TEST_USER_B_ID',
  'SUPABASE_TEST_USER_B_TOKEN',
] as const;

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `Supabase integration requires runtime variables: ${missing.join(', ')}`,
  );
  process.exit(1);
}

const value = (name: string): string => {
  const result = process.env[name]?.trim();
  if (!result) throw new Error(`Missing ${name}`);
  return result;
};

const clientFor = (tokenName: 'A' | 'B'): SupabaseClient =>
  createClient(value('SUPABASE_URL'), value('SUPABASE_PUBLISHABLE_KEY'), {
    accessToken: async () => value(`SUPABASE_TEST_USER_${tokenName}_TOKEN`),
  });

const userId = (name: 'A' | 'B'): string =>
  value(`SUPABASE_TEST_USER_${name}_ID`);

const unwrap = async <T>(
  operation: string,
  request: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> => {
  const { data, error } = await request;
  if (error) throw new Error(`${operation}: ${error.message}`);
  return data;
};

const a = clientFor('A');
const b = clientFor('B');
const idA = userId('A');
const idB = userId('B');
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `integration-${suffix}`;
let postId: string | null = null;

try {
  await unwrap(
    'seed user A',
    a.from('app_users').upsert({ id: idA, name: `Integration A ${suffix}` }),
  );
  await unwrap(
    'seed user B',
    b.from('app_users').upsert({ id: idB, name: `Integration B ${suffix}` }),
  );

  const post = await unwrap(
    'create post as user A',
    a
      .from('posts')
      .insert({
        author_id: idA,
        excerpt: 'RLS integration fixture',
        forum: 'Dining',
        title,
      })
      .select('id')
      .single(),
  );
  assert(post);
  postId = post.id as string;

  const unauthorizedUpdate = await b
    .from('posts')
    .update({ title: `${title}-tampered` })
    .eq('id', postId)
    .select('id');
  assert.equal(unauthorizedUpdate.error, null);
  assert.deepEqual(unauthorizedUpdate.data, []);

  await unwrap(
    'create cross-user comment',
    b
      .from('comments')
      .insert({ author_id: idB, body: 'RLS comment', post_id: postId })
      .select('id')
      .single(),
  );

  const postAfterComment = await unwrap(
    'read reply count',
    a.from('posts').select('reply_count').eq('id', postId).single(),
  );
  assert(postAfterComment);
  assert.equal(postAfterComment.reply_count, 1);

  await unwrap(
    'create own like',
    b.from('post_likes').insert({ post_id: postId, user_id: idB }),
  );
  const likeCount = await unwrap(
    'read like count',
    a.from('posts').select('like_count').eq('id', postId).single(),
  );
  assert(likeCount);
  assert.equal(likeCount.like_count, 1);

  const forbiddenProfileUpdate = await b
    .from('app_users')
    .update({ name: 'must-not-change' })
    .eq('id', idA)
    .select('id');
  assert.equal(forbiddenProfileUpdate.error, null);
  assert.deepEqual(forbiddenProfileUpdate.data, []);

  await unwrap(
    'store own push token',
    a
      .from('push_tokens')
      .upsert({
        platform: 'ios',
        token: `ExponentPushToken[integration-${suffix}]`,
        user_id: idA,
      })
      .select('user_id')
      .single(),
  );

  console.log(
    'Supabase integration passed: RLS identity isolation, writes, triggers, and push-token ownership.',
  );
} finally {
  if (postId) {
    const cleanup = await a.from('posts').delete().eq('id', postId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
}
