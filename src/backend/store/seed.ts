import type {
  NotificationPrefs,
  StoredEvent,
  StoredMission,
  StoredPost,
  StoredProfile,
  StoredUser,
  StoredWeekDay,
  StoreState,
} from './types';

export const DEMO_USER_ID = 'demo-user';

// WHY: anchored to the real wall clock at seed time so forum posts render the
// design's relative-age labels (2h / 5h / 1d) instead of all collapsing to "now"
// against a hardcoded future instant.
export const SEED_NOW_ISO = new Date().toISOString();

const HOUR_MS = 60 * 60 * 1000;

const isoHoursBeforeSeedNow = (hours: number): string =>
  new Date(Date.parse(SEED_NOW_ISO) - hours * HOUR_MS).toISOString();

const defaultNotificationPrefs: NotificationPrefs = {
  events: true,
  replies: true,
  missions: true,
  digest: false,
};

const emptyProfile = (): StoredProfile => ({
  role: null,
  interests: [],
  aiComfort: null,
  notificationPrefs: defaultNotificationPrefs,
  onboardedAt: null,
});

interface SeedUserInput {
  readonly id: string;
  readonly name: string;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly previousRank: number | null;
}

const seedUser = ({
  id,
  missionsCompleted,
  name,
  previousRank,
  streakDays,
  xp,
}: SeedUserInput): StoredUser => ({
  id,
  name,
  xp,
  streakDays,
  missionsCompleted,
  previousRank,
  title: 'LAKE EXPLORER',
  profile: emptyProfile(),
});

const seedUsers = (): readonly StoredUser[] => [
  seedUser({
    id: 'user-mia',
    name: 'Mia Lake',
    xp: 3820,
    streakDays: 0,
    missionsCompleted: 41,
    previousRank: 1,
  }),
  seedUser({
    id: 'user-andre',
    name: 'Andre King',
    xp: 3540,
    streakDays: 0,
    missionsCompleted: 38,
    previousRank: 3,
  }),
  seedUser({
    id: 'user-jordan',
    name: 'Jordan Diaz',
    xp: 3110,
    streakDays: 0,
    missionsCompleted: 35,
    previousRank: 2,
  }),
  seedUser({
    id: 'user-priya',
    name: 'Priya Rao',
    xp: 2640,
    streakDays: 0,
    missionsCompleted: 29,
    previousRank: 6,
  }),
  seedUser({
    id: 'user-sam',
    name: 'Sam Ortiz',
    xp: 2190,
    streakDays: 0,
    missionsCompleted: 24,
    previousRank: 5,
  }),
  seedUser({
    id: DEMO_USER_ID,
    name: 'You',
    xp: 1980,
    streakDays: 12,
    missionsCompleted: 21,
    previousRank: 7,
  }),
  seedUser({
    id: 'user-hoa',
    name: 'HOA Board',
    xp: 0,
    streakDays: 0,
    missionsCompleted: 0,
    previousRank: null,
  }),
  seedUser({
    id: 'user-riley',
    name: 'Riley Kim',
    xp: 0,
    streakDays: 0,
    missionsCompleted: 0,
    previousRank: null,
  }),
];

const seedPosts = (): readonly StoredPost[] => [
  {
    id: 'post-1',
    forum: 'Marina & Boating',
    authorId: 'user-jordan',
    createdAt: isoHoursBeforeSeedNow(2),
    title: 'Best spots to kayak at sunrise?',
    excerpt:
      'New to the lake — where do you all put in before the wind picks up? Looking for calm water near the village.',
    replies: 24,
    likes: 61,
    likedBy: [],
    pinned: false,
  },
  {
    id: 'post-2',
    forum: 'Announcements',
    authorId: 'user-hoa',
    createdAt: isoHoursBeforeSeedNow(5),
    title: 'Fountain show returns Friday nights',
    excerpt:
      'Starting this week the Village fountains run 7–10pm. Bring the family down to the promenade.',
    replies: 12,
    likes: 138,
    likedBy: [],
    pinned: true,
  },
  {
    id: 'post-3',
    forum: 'Dining',
    authorId: 'user-mia',
    createdAt: isoHoursBeforeSeedNow(24),
    title: 'New patio at the waterfront bistro',
    excerpt:
      'They finally opened lakeside seating. Go early — it filled up fast on Saturday.',
    replies: 33,
    likes: 92,
    likedBy: [],
    pinned: false,
  },
  {
    id: 'post-4',
    forum: 'Trails',
    authorId: 'user-andre',
    createdAt: isoHoursBeforeSeedNow(25),
    title: 'Loop trail partially closed for repaving',
    excerpt:
      'North segment is down until next Tuesday. Detour is signed near the boat club.',
    replies: 8,
    likes: 27,
    likedBy: [],
    pinned: false,
  },
];

const seedEvents = (): readonly StoredEvent[] => [
  {
    id: 'event-1',
    startsAt: '2026-07-18T18:30:00.000Z',
    timeLabel: '6:30 PM',
    dayLabel: 'FRI',
    dateLabel: '18',
    title: 'Locals Networking Mixer',
    place: 'MonteLago Village',
    tag: 'Networking',
    featured: true,
    going: 48,
    joinedBy: [],
    attendeeIds: ['user-riley', 'user-mia', 'user-jordan', 'user-andre'],
  },
  {
    id: 'event-2',
    startsAt: '2026-07-19T09:00:00.000Z',
    timeLabel: '9:00 AM',
    dayLabel: 'SAT',
    dateLabel: '19',
    title: 'Farmers Market on the Promenade',
    place: 'Waterfront Promenade',
    tag: 'Community',
    featured: false,
    going: 210,
    joinedBy: [],
    attendeeIds: ['user-mia', 'user-hoa', 'user-jordan'],
  },
  {
    id: 'event-3',
    startsAt: '2026-07-20T17:45:00.000Z',
    timeLabel: '5:45 PM',
    dayLabel: 'SUN',
    dateLabel: '20',
    title: 'Sunset Paddleboard Meetup',
    place: 'Village Marina',
    tag: 'Outdoors',
    featured: false,
    going: 32,
    joinedBy: [],
    attendeeIds: ['user-andre', 'user-jordan'],
  },
  {
    id: 'event-4',
    startsAt: '2026-07-23T08:00:00.000Z',
    timeLabel: '8:00 AM',
    dayLabel: 'WED',
    dateLabel: '23',
    title: 'Small Business Coffee & Connect',
    place: 'Lakeside Café',
    tag: 'Networking',
    featured: false,
    going: 19,
    joinedBy: [],
    attendeeIds: ['user-riley', 'user-mia'],
  },
];

const seedMissions = (): readonly StoredMission[] => [
  {
    id: 'mission-1',
    title: 'Sunrise at the Marina',
    description: 'Check in at Village Marina before 8 AM.',
    xp: 50,
    stopsTotal: 1,
    icon: 'Sun',
    progressByUser: {
      [DEMO_USER_ID]: { status: 'active', stopsDone: 0 },
    },
  },
  {
    id: 'mission-2',
    title: 'Trail Trekker',
    description: 'Complete the 3-mile lakeside loop.',
    xp: 120,
    stopsTotal: 3,
    icon: 'ArrowUp',
    progressByUser: {
      [DEMO_USER_ID]: { status: 'active', stopsDone: 2 },
    },
  },
  {
    id: 'mission-3',
    title: 'Taste of the Village',
    description: 'Visit 3 different lakeside eateries.',
    xp: 90,
    stopsTotal: 3,
    icon: 'Star',
    progressByUser: {
      [DEMO_USER_ID]: { status: 'done', stopsDone: 3 },
    },
  },
  {
    id: 'mission-4',
    title: 'Fountain Night Owl',
    description: 'Attend a Friday fountain show.',
    xp: 40,
    stopsTotal: 1,
    icon: 'Moon',
    progressByUser: {
      [DEMO_USER_ID]: { status: 'locked', stopsDone: 0 },
    },
  },
];

const seedWeek = (): readonly StoredWeekDay[] => [
  { dayLabel: 'MON', dateLabel: '14', date: '2026-07-14', isToday: false },
  { dayLabel: 'TUE', dateLabel: '15', date: '2026-07-15', isToday: false },
  { dayLabel: 'WED', dateLabel: '16', date: '2026-07-16', isToday: false },
  { dayLabel: 'THU', dateLabel: '17', date: '2026-07-17', isToday: false },
  { dayLabel: 'FRI', dateLabel: '18', date: '2026-07-18', isToday: true },
  { dayLabel: 'SAT', dateLabel: '19', date: '2026-07-19', isToday: false },
  { dayLabel: 'SUN', dateLabel: '20', date: '2026-07-20', isToday: false },
];

export const createSeedState = (): StoreState => ({
  subforums: [
    'All',
    'Announcements',
    'Marina & Boating',
    'Dining',
    'Trails',
    'Buy & Sell',
    'Events',
  ],
  posts: seedPosts(),
  events: seedEvents(),
  missions: seedMissions(),
  users: seedUsers(),
  week: seedWeek(),
});
