import { getState } from '@/src/backend/store';

export function listSubforums(): readonly string[] {
  return getState().subforums;
}
