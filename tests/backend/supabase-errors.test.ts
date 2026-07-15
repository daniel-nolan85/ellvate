import { describe, expect, test } from 'bun:test';

import { SupabaseRequestError, throwIfSupabaseError } from '../../src/services/supabase';

describe('Supabase error normalization', () => {
  test('throws a named infrastructure error for database failures', () => {
    expect(() =>
      throwIfSupabaseError({ message: 'permission denied' }, 'create post'),
    ).toThrowError(new SupabaseRequestError('create post', 'permission denied'));
  });

  test('does not throw for a successful operation', () => {
    expect(() => throwIfSupabaseError(null, 'create post')).not.toThrow();
  });
});
