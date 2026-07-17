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
  aiComfort: null,
  notificationPrefs: defaultNotificationPrefs(),
  onboardedAt: null,
});

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
    name: 'You',
    avatarUrl: null,
    xp: 0,
    streakDays: 0,
    missionsCompleted: 0,
    previousRank: null,
    title: DEFAULT_PROGRESS_TITLE,
    profile: defaultProfile(),
    mutedUserIds: [],
  };

  setState((current) => ({
    ...current,
    users: [...current.users, created],
  }));

  return created;
}
