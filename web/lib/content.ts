// Marketing copy, kept as data so the section components stay pure
// presentation. Grounded in the app's real feature set -- keep this in sync
// with ../../src/modules/** and ../../README.md if the app's functionality
// changes; the whole point of this file is to never say the app does
// something it doesn't.

export const BRAND = {
  appName: 'Community Copilot',
  community: 'Lake Las Vegas',
  company: 'Norez Solutions',
} as const;

export type FeatureAccent = 'accent' | 'amber' | 'lake' | 'palm' | 'plum';

export interface Feature {
  id: string;
  title: string;
  hook: string;
  description: string;
  highlights: readonly string[];
  goodFor: string;
  accent: FeatureAccent;
  icon: string;
  special?: boolean;
}

export const features: readonly Feature[] = [
  {
    id: 'forum',
    title: 'Forum',
    hook: 'Where the neighborhood actually talks.',
    description:
      'One feed for everything happening around Lake Las Vegas, organized into channels so you only see what you came for — Announcements, HOA, Marina & Boating, Golf, Trails, Dining, Sports Club, and Buy & Sell.',
    highlights: [
      'Post, reply, and like in real time',
      'Pinned announcements from HOA and official channels',
      'Bookmark posts to find them again later',
      'Edit or delete your own posts and comments any time',
    ],
    goodFor:
      "Residents who want the honest, unfiltered version of what's actually going on — not buried three days deep in a Facebook group.",
    accent: 'accent',
    icon: 'MessagesSquare',
  },
  {
    id: 'events',
    title: 'Events',
    hook: "Never miss what's happening around the lake.",
    description:
      "A shared calendar for the whole community — resident meetups, HOA meetings, marina days, club nights. See what's coming up, RSVP in a tap, and get reminded the day of.",
    highlights: [
      'One-tap RSVP with a visible attendee list',
      "Day-of reminders so it doesn't sneak up on you",
      'Comment threads on every event',
      'Residents can create their own events, not just official ones',
    ],
    goodFor:
      'Anyone tired of missing things because they were buried in an email newsletter or a flyer on a board.',
    accent: 'amber',
    icon: 'CalendarDays',
  },
  {
    id: 'petitions',
    title: 'Petitions',
    hook: 'Turn "someone should really fix that" into action.',
    description:
      "See a real problem around the community — a dark stretch of trail, a stop sign that needs replacing? Start a petition and get your neighbors to sign it. Once it reaches its goal, it goes straight to the HOA board.",
    highlights: [
      'Start a petition for anything worth fixing around the community',
      'Neighbors sign with one tap — no forms, no printouts',
      'Track progress toward the signature goal in real time',
      'Petitions that reach their goal are sent straight to the HOA board',
    ],
    goodFor:
      'Anyone who has ever thought "somebody should really do something about that" and wanted an actual way to make it happen.',
    accent: 'accent',
    icon: 'FileSignature',
  },
  {
    id: 'missions',
    title: 'Missions',
    hook: "Turn 'get out more' into a game.",
    description:
      "Themed challenges — Trail, Water, Village, Day, Night, and Social — that nudge you to actually go explore Lake Las Vegas: check in at the marina before sunrise, try a restaurant you've never been to, walk a trail on the other side of the lake. Photo check-ins prove you were there; XP and streaks keep you coming back.",
    highlights: [
      'Six mission themes, from sunrise marina walks to social mixers',
      'Photo-proof check-ins at each stop along the way',
      'XP and levels that grow the more you explore',
      'Daily streaks that reward showing up consistently',
    ],
    goodFor: 'People who want an actual reason to get out of the house and explore their own neighborhood.',
    accent: 'palm',
    icon: 'Flag',
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    hook: 'Friendly competition keeps everyone honest.',
    description:
      "See who's most active in the community this week, this month, or all-time — a podium for the top three, and your own rank right below it.",
    highlights: [
      'Weekly, monthly, and all-time rankings',
      'A podium view for the top 3',
      'Points earned from missions, posts, and community activity',
    ],
    goodFor:
      'Anyone competitive enough to want bragging rights for being the most plugged-in neighbor on the lake.',
    accent: 'plum',
    icon: 'Trophy',
  },
  {
    id: 'services',
    title: 'Services',
    hook: 'Local business, found by neighbors.',
    description:
      'A directory of local businesses and tradespeople, recommended by people who actually live here — home services, pet care, automotive, pool & spa, beauty, tech & web, dining, and more — each with honest, rating-only reviews from real residents.',
    highlights: [
      'Eight categories covering the trades neighbors ask about most',
      'Rating-only reviews — no essay required, just a real score',
      'Photos and contact info on every listing',
      'Add a listing for a business you personally trust',
    ],
    goodFor: 'Anyone who has ever typed "does anyone have a good pool guy?" into a group chat and waited.',
    accent: 'lake',
    icon: 'Store',
  },
  {
    id: 'assistant',
    title: 'AI Assistant',
    hook: 'Ask it anything about the community.',
    description:
      "A built-in assistant that answers questions grounded in real app content, not generic chatbot filler. Ask what's happening this weekend, which restaurants are in the Dining forum, or how missions work, and get an answer sourced from the actual community.",
    highlights: [
      'Answers grounded in real forum posts, events, and listings',
      'Falls back to a deterministic search when live AI is unavailable, never a made-up answer',
      'Quick-start suggestion chips for common questions',
    ],
    goodFor: 'New residents who want the lay of the land without scrolling through months of old posts.',
    accent: 'accent',
    icon: 'Sparkles',
    special: true,
  },
] as const;

export const serviceCategories = [
  { label: 'Home services', icon: 'Wrench' },
  { label: 'Pet care', icon: 'PawPrint' },
  { label: 'Automotive', icon: 'Car' },
  { label: 'Pool & spa', icon: 'Waves' },
  { label: 'Beauty', icon: 'Sparkles' },
  { label: 'Tech & web', icon: 'Laptop' },
  { label: 'Dining', icon: 'Utensils' },
  { label: 'Other', icon: 'Store' },
] as const;

export const faqs = [
  {
    question: `When does ${BRAND.appName} launch?`,
    answer:
      "We're putting the finishing touches on the app now. Join the waitlist and we'll email you the moment it's available.",
  },
  {
    question: 'Is it free to use?',
    answer: `Yes. ${BRAND.appName} is free for everyone in the ${BRAND.community} community.`,
  },
  {
    question: `Is this only for ${BRAND.community}?`,
    answer: `${BRAND.appName} is built specifically for ${BRAND.community} — residents, homeowners, and regulars. It's not a generic app dropped into every neighborhood; the forum channels, missions, and services directory are all built around this community.`,
  },
  {
    question: 'What devices will it support?',
    answer: 'iOS and Android at launch, built as a single native app for both.',
  },
] as const;

// The "Who built this?" FAQ answer is assembled from this directly in
// components/sections/faq.tsx (first names linked inline), rather than
// living in `faqs` as a plain string.
export const founders = [
  { firstName: 'Daniel', fullName: 'Daniel Nolan', linkedin: 'https://www.linkedin.com/in/daniel-nolan85/' },
  {
    firstName: 'Ian',
    fullName: 'Ian Perez',
    linkedin: 'https://www.linkedin.com/in/shadowysupercoder/',
  },
] as const;
