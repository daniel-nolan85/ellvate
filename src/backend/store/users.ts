import { getState, setState } from './store';
import type { NotificationPrefs, StoredProfile, StoredUser } from './types';

export const DEFAULT_PROGRESS_TITLE = 'LAKE EXPLORER';

const defaultNotificationPrefs = (): NotificationPrefs => ({
  events: true,
  replies: true,
  missions: true,
  digest: false,
});

export const defaultProfile = (): StoredProfile => ({
  role: null,
  interests: [],
  notificationPrefs: defaultNotificationPrefs(),
  onboardedAt: null,
  activityVisible: false,
});

// A deterministic per-user fallback name for anyone who hasn't set their own
// yet -- distinguishes people from each other (a single shared placeholder
// like "Member" makes every unnamed user look like the same person
// everywhere their content appears) without forcing a name on anyone who'd
// rather stay anonymous. Same userId always yields the same code.
export function defaultDisplayName(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  const code = String(hash % 10000).padStart(4, '0');
  return `Neighbor ${code}`;
}

// WHY: any authenticated identity that is not part of the seed (a real Clerk
// user) needs a user row before it can accrue XP or a profile; without this,
// mission check-ins and profile writes would silently target a missing row.
export function ensureUser(userId: string): StoredUser {
  const existing = getState().users.find((user) => user.id === userId);
  if (existing) {
    return existing;
  }

  const created: StoredUser = {
    id: userId,
    name: defaultDisplayName(userId),
    avatarUrl: null,
    xp: 0,
    streakDays: 0,
    missionsCompleted: 0,
    previousRank: null,
    title: DEFAULT_PROGRESS_TITLE,
    profile: defaultProfile(),
    mutedUserIds: [],
    pinnedPostId: null,
  };

  setState((current) => ({
    ...current,
    users: [...current.users, created],
  }));

  return created;
}
