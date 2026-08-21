import type {
  NotificationPrefs,
  StoredComment,
  StoredEvent,
  StoredMission,
  StoredPost,
  StoredProfile,
  StoredServiceListing,
  StoredServiceReview,
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

const EVENT_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

// WHY: anchored to the real wall clock (like isoHoursBeforeSeedNow above) so
// seeded events always land in the future relative to whenever the app is
// actually run, instead of drifting into the past on a fixed calendar date
// and silently vanishing once the "hide past events" filter (events.ts)
// ships.
const seedEventFields = (
  daysFromSeedNow: number,
  hour: number,
  minute: number,
): { readonly startsAt: string; readonly dayLabel: string; readonly dateLabel: string } => {
  const date = new Date(Date.parse(SEED_NOW_ISO));
  date.setUTCDate(date.getUTCDate() + daysFromSeedNow);
  date.setUTCHours(hour, minute, 0, 0);
  return {
    startsAt: date.toISOString(),
    dayLabel: EVENT_WEEKDAYS[date.getUTCDay()],
    dateLabel: String(date.getUTCDate()),
  };
};

const defaultNotificationPrefs: NotificationPrefs = {
  digest: false,
  events: true,
  missions: true,
  petitions: true,
  replies: true,
};

const emptyProfile = (): StoredProfile => ({
  role: null,
  interests: [],
  notificationPrefs: defaultNotificationPrefs,
  onboardedAt: null,
  activityVisible: false,
});

interface SeedUserInput {
  readonly id: string;
  readonly name: string;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly previousRank: number | null;
  readonly pinnedPostId?: string | null;
}

const seedUser = ({
  id,
  missionsCompleted,
  name,
  pinnedPostId = null,
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
  mutedUserIds: [],
  avatarUrl: null,
  pinnedPostId,
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
    // Seeded so the demo shows the pin feature already in use, matching the
    // Announcements post that used to be globally pinned before pinning
    // became per-user.
    pinnedPostId: 'post-2',
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

const seedComments = (): readonly StoredComment[] => [
  {
    authorId: 'user-mia',
    body: '@Jordan I launch before 7 AM and the water is usually glassy.',
    createdAt: isoHoursBeforeSeedNow(1.5),
    editedAt: null,
    id: 'comment-1',
    postId: 'post-1',
  },
  {
    authorId: 'user-sam',
    body: 'The MonteLago marina has been the calmest launch for me.',
    createdAt: isoHoursBeforeSeedNow(1),
    editedAt: null,
    id: 'comment-2',
    postId: 'post-1',
  },
  {
    authorId: 'user-riley',
    body: 'We will be there Friday. Thanks for the heads-up!',
    createdAt: isoHoursBeforeSeedNow(4),
    editedAt: null,
    id: 'comment-3',
    postId: 'post-2',
  },
  {
    authorId: 'user-priya',
    body: 'The patio is especially nice right before sunset.',
    createdAt: isoHoursBeforeSeedNow(20),
    editedAt: null,
    id: 'comment-4',
    postId: 'post-3',
  },
  {
    authorId: 'user-jordan',
    body: '@Mia Do they take reservations for the lakeside tables?',
    createdAt: isoHoursBeforeSeedNow(18),
    editedAt: null,
    id: 'comment-5',
    postId: 'post-3',
  },
  {
    authorId: 'user-priya',
    body: 'The marked detour adds about ten minutes by bike.',
    createdAt: isoHoursBeforeSeedNow(22),
    editedAt: null,
    id: 'comment-6',
    postId: 'post-4',
  },
];

const replyCount = (
  comments: readonly StoredComment[],
  postId: string,
): number => comments.filter((comment) => comment.postId === postId).length;

const seedPosts = (
  comments: readonly StoredComment[],
): readonly StoredPost[] => [
  {
    id: 'post-1',
    forum: 'Marina & Boating',
    authorId: 'user-jordan',
    createdAt: isoHoursBeforeSeedNow(2),
    title: 'Best spots to kayak at sunrise?',
    excerpt:
      'New to the lake — where do you all put in before the wind picks up? Looking for calm water near the village.',
    replies: replyCount(comments, 'post-1'),
    likes: 61,
    likedBy: [],
    editedAt: null,
  },
  {
    id: 'post-2',
    forum: 'Announcements',
    authorId: 'user-hoa',
    createdAt: isoHoursBeforeSeedNow(5),
    title: 'Fountain show returns Friday nights',
    excerpt:
      'Starting this week the Village fountains run 7–10pm. Bring the family down to the promenade.',
    replies: replyCount(comments, 'post-2'),
    likes: 138,
    likedBy: [],
    editedAt: null,
  },
  {
    id: 'post-3',
    forum: 'Dining',
    authorId: 'user-mia',
    createdAt: isoHoursBeforeSeedNow(24),
    title: 'New patio at the waterfront bistro',
    excerpt:
      'They finally opened lakeside seating. Go early — it filled up fast on Saturday.',
    replies: replyCount(comments, 'post-3'),
    likes: 92,
    likedBy: [],
    editedAt: null,
  },
  {
    id: 'post-4',
    forum: 'Trails',
    authorId: 'user-andre',
    createdAt: isoHoursBeforeSeedNow(25),
    title: 'Loop trail partially closed for repaving',
    excerpt:
      'North segment is down until next Tuesday. Detour is signed near the boat club.',
    replies: replyCount(comments, 'post-4'),
    likes: 27,
    likedBy: [],
    editedAt: null,
  },
];

const seedEvents = (): readonly StoredEvent[] => [
  {
    id: 'event-1',
    authorId: 'user-hoa',
    ...seedEventFields(2, 18, 30),
    timeLabel: '6:30 PM',
    title: 'Locals Networking Mixer',
    place: 'MonteLago Village',
    tag: 'Networking',
    featured: true,
    going: 48,
    joinedBy: [],
    attendeeIds: ['user-riley', 'user-mia', 'user-jordan', 'user-andre'],
    editedAt: null,
  },
  {
    id: 'event-2',
    authorId: 'user-mia',
    ...seedEventFields(3, 9, 0),
    timeLabel: '9:00 AM',
    title: 'Farmers Market on the Promenade',
    place: 'Waterfront Promenade',
    tag: 'Community',
    featured: false,
    going: 210,
    joinedBy: [],
    attendeeIds: ['user-mia', 'user-hoa', 'user-jordan'],
    editedAt: null,
  },
  {
    id: 'event-3',
    authorId: 'user-andre',
    ...seedEventFields(4, 17, 45),
    timeLabel: '5:45 PM',
    title: 'Sunset Paddleboard Meetup',
    place: 'Village Marina',
    tag: 'Outdoors',
    featured: false,
    going: 32,
    joinedBy: [],
    attendeeIds: ['user-andre', 'user-jordan'],
    editedAt: null,
  },
  {
    id: 'event-4',
    authorId: 'user-jordan',
    ...seedEventFields(7, 8, 0),
    timeLabel: '8:00 AM',
    title: 'Small Business Coffee & Connect',
    place: 'Lakeside Café',
    tag: 'Networking',
    featured: false,
    going: 19,
    joinedBy: [],
    attendeeIds: ['user-riley', 'user-mia'],
    editedAt: null,
  },
];

const seedMissions = (): readonly StoredMission[] => [
  {
    id: 'mission-1',
    authorId: 'user-hoa',
    title: 'Sunrise at the Marina',
    description: 'Check in at Village Marina before 8 AM.',
    scheduledFor: '2026-07-14',
    xp: 50,
    stopsTotal: 1,
    stops: ['Check in at the Village Marina dock before 8 AM.'],
    theme: 'water',
    editedAt: null,
    // No entry for DEMO_USER_ID — not yet accepted, shows in "Available".
    progressByUser: {},
  },
  {
    id: 'mission-2',
    authorId: 'user-hoa',
    title: 'Trail Trekker',
    description: 'Complete the 3-mile lakeside loop.',
    scheduledFor: '2026-07-15',
    xp: 120,
    stopsTotal: 3,
    stops: [
      'Start at the trailhead by the marina and head south.',
      'Rest at the overlook bench at the halfway point.',
      'Finish the loop back at the promenade.',
    ],
    theme: 'trail',
    editedAt: null,
    progressByUser: {
      [DEMO_USER_ID]: { completedAt: null, status: 'active', stopsDone: 2 },
    },
  },
  {
    id: 'mission-3',
    authorId: 'user-hoa',
    title: 'Taste of the Village',
    description: 'Visit 3 different lakeside eateries.',
    scheduledFor: '2026-07-16',
    xp: 90,
    stopsTotal: 3,
    stops: [
      'Grab tacos at the marina taco stand.',
      'Try the wood-fired pizza on the promenade.',
      'Finish with gelato at the village square.',
    ],
    theme: 'village',
    editedAt: null,
    progressByUser: {
      [DEMO_USER_ID]: {
        completedAt: isoHoursBeforeSeedNow(48),
        status: 'done',
        stopsDone: 3,
      },
    },
  },
  {
    id: 'mission-4',
    authorId: 'user-hoa',
    title: 'Fountain Night Owl',
    description: 'Attend a Friday fountain show.',
    scheduledFor: '2026-07-18',
    xp: 40,
    stopsTotal: 1,
    stops: ['Watch the Friday night fountain show from the promenade.'],
    theme: 'night',
    editedAt: null,
    // No entry for DEMO_USER_ID — not yet accepted, shows in "Available".
    progressByUser: {},
  },
];

const seedServiceListings = (): readonly StoredServiceListing[] => [
  {
    id: 'service-1',
    authorId: 'user-riley',
    businessName: 'Lakeside Tails Dog Walking',
    category: 'pet-care',
    description:
      'Daily walks and drop-in visits for dogs of all sizes, seven days a week.',
    contactPhone: '(702) 555-0142',
    contactEmail: 'riley@lakesidetails.example',
    contactWebsite: null,
    serviceArea: 'Lake Las Vegas & MonteLago Village',
    hours: 'Mon–Sun 7am–7pm',
    createdAt: isoHoursBeforeSeedNow(96),
    editedAt: null,
  },
  {
    id: 'service-2',
    authorId: 'user-andre',
    businessName: "King's Mobile Detailing",
    category: 'automotive',
    description:
      'Full interior and exterior detailing at your driveway — no drop-off needed.',
    contactPhone: '(702) 555-0198',
    contactEmail: null,
    contactWebsite: 'https://kingsdetailing.example',
    serviceArea: 'Lake Las Vegas',
    hours: 'Mon–Sat 8am–6pm',
    createdAt: isoHoursBeforeSeedNow(72),
    editedAt: null,
  },
  {
    id: 'service-3',
    authorId: 'user-sam',
    businessName: 'Crystal Clear Pool Care',
    category: 'pool-spa',
    description: 'Weekly pool cleaning, chemical balancing, and equipment repair.',
    contactPhone: '(702) 555-0176',
    contactEmail: 'sam@crystalclearpools.example',
    contactWebsite: null,
    serviceArea: 'Lake Las Vegas & Henderson',
    hours: null,
    createdAt: isoHoursBeforeSeedNow(50),
    editedAt: null,
  },
  {
    id: 'service-4',
    authorId: 'user-priya',
    businessName: 'Priya Rao Web Design',
    category: 'tech-web',
    description: 'Websites and small business branding for neighbors — from a neighbor.',
    contactPhone: null,
    contactEmail: 'priya@priyaraodesign.example',
    contactWebsite: 'https://priyaraodesign.example',
    serviceArea: 'Remote & on-site',
    hours: null,
    createdAt: isoHoursBeforeSeedNow(30),
    editedAt: null,
  },
];

const seedServiceReviews = (): readonly StoredServiceReview[] => [
  {
    id: 'service-review-1',
    listingId: 'service-1',
    authorId: 'user-mia',
    rating: 5,
    body: 'Riley has been walking our lab for months — always on time and sends photos!',
    createdAt: isoHoursBeforeSeedNow(40),
    editedAt: null,
  },
  {
    id: 'service-review-2',
    listingId: 'service-2',
    authorId: DEMO_USER_ID,
    rating: 4,
    body: 'Came right to our driveway and the car looked brand new.',
    createdAt: isoHoursBeforeSeedNow(20),
    editedAt: null,
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

export const createSeedState = (): StoreState => {
  const comments = seedComments();

  return {
    subforums: [
      'All',
      'Announcements',
      'HOA',
      'Marina & Boating',
      'Dining',
      'Trails',
      'Golf',
      'Sports Club',
      'Buy & Sell',
      'Events',
    ],
    posts: seedPosts(comments),
    comments,
    postReports: [],
    commentReports: [],
    events: seedEvents(),
    eventComments: [],
    eventCommentReports: [],
    missions: seedMissions(),
    missionComments: [],
    missionCommentReports: [],
    missionCheckIns: [],
    missionCheckInReports: [],
    serviceListings: seedServiceListings(),
    serviceReviews: seedServiceReviews(),
    serviceReviewReports: [],
    notifications: [],
    contactMessages: [],
    petitions: [],
    petitionSignatures: [],
    petitionComments: [],
    petitionReports: [],
    petitionCommentReports: [],
    bookmarks: [],
    users: seedUsers(),
    week: seedWeek(),
  };
};
