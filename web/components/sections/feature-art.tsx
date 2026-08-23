import { ArrowUp, FileSignature, Heart, MessageCircle, Plus, Sparkles, Star, Sun, Utensils } from 'lucide-react';

import { DigestDateRange } from './digest-date-range';

const DIGEST_STATS = [
  { label: 'Posts', value: '12' },
  { label: 'Events', value: '3' },
  { label: 'Missions', value: '8' },
  { label: 'Active', value: '41' },
] as const;

// Static, non-interactive mockups built from the same desert design tokens
// as the real components they stand in for -- not literal screenshots (the
// app has none to spare pre-launch), but the same approach the app's own
// onboarding uses for its feature walkthrough
// (../../../src/modules/onboarding/feature-step.tsx: ForumArt, EventsArt,
// MissionsArt, ServicesArt, LeaderboardArt, AssistantArt). Keep these in
// sync with that file if the real cards' content/labels drift.

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum-subtle text-xs font-semibold text-plum">
      {initials}
    </div>
  );
}

export function ForumArt() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Avatar name="Jordan Diaz" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Jordan Diaz</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-lake-subtle px-2 py-0.5 font-medium text-lake">
              Marina &amp; Boating
            </span>
            <span>· 4h</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Best spots to kayak at sunrise?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New to the lake, where do you all put in before the wind picks up?
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-amber-subtle px-3 py-1.5 text-xs font-semibold text-amber">
          <Heart className="h-3.5 w-3.5" fill="currentColor" />
          24
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
          <MessageCircle className="h-3.5 w-3.5" />9
        </span>
      </div>
    </div>
  );
}

export function EventsArt() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-paper p-3.5 shadow-sm">
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-accent-subtle py-2">
        <span className="text-[10px] font-bold tracking-wide text-accent">FRI</span>
        <span className="text-lg font-bold text-accent">18</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Locals Networking Mixer</p>
        <p className="text-xs text-muted-foreground">6:30 PM · MonteLago Village</p>
        <p className="text-xs text-muted-foreground/70">48 going</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Plus className="h-4 w-4" />
      </div>
    </div>
  );
}

// Title/category from the app's own dummy seed content
// (src/backend/store/seed.ts, id "petition-marina-lighting") -- not invented
// for this mockup. Its seed signature count (27 of 45) predates/simplifies
// the real 200-signature floor though, so the count shown here is adjusted
// to actually match the 200-signature rule stated three times in the copy
// right next to this, rather than contradicting it.
export function PetitionArt() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-plum-subtle">
          <FileSignature className="h-5 w-5 text-plum" />
        </div>
        <div>
          <p className="text-sm font-semibold">Add lighting to the marina walkway</p>
          <p className="text-xs text-muted-foreground">Started by a neighbor · Safety</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div className="h-1.5 w-[71%] rounded-full bg-plum" />
        </div>
        <span className="shrink-0 text-xs font-semibold text-plum">142/200</span>
      </div>
      <div className="rounded-full bg-plum py-2 text-center text-xs font-semibold text-white">
        Sign this petition
      </div>
    </div>
  );
}

export function MissionsArt() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-paper p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle">
          <Sun className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold">Sunrise at the Marina</p>
          <p className="text-xs text-muted-foreground">Check in at Village Marina before 8 AM.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[true, true, false].map((filled, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${filled ? 'bg-accent' : 'bg-muted'}`} />
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">2/3 stops</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-subtle px-2 py-1 text-xs font-semibold text-amber">
          <Star className="h-2.5 w-2.5" fill="currentColor" />
          50 XP
        </span>
      </div>
    </div>
  );
}

export function ServicesArt() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-paper p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-subtle">
        <Utensils className="h-5 w-5 text-amber" />
      </div>
      <div>
        <p className="text-sm font-semibold">Lakeside Bistro</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-subtle px-2 py-0.5 text-xs font-medium text-amber">Dining</span>
          <span className="flex items-center gap-1 text-xs">
            <Star className="h-3 w-3 text-amber" fill="currentColor" />
            <span className="font-semibold">4.8</span>
            <span className="text-muted-foreground">(32)</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardArt() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-paper px-3.5 py-3 shadow-sm">
        <span className="w-5 text-center text-sm font-bold text-muted-foreground">1</span>
        <Avatar name="Mia Lake" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Mia Lake</p>
          <p className="text-xs text-muted-foreground">3,820 XP</p>
        </div>
        <span className="text-sm font-bold">41</span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-accent px-3.5 py-3 shadow-sm">
        <span className="w-5 text-center text-sm font-bold text-white">6</span>
        <Avatar name="You" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">You</p>
          <p className="text-xs text-white/75">1,980 XP</p>
        </div>
        <ArrowUp className="h-3.5 w-3.5 text-white" />
        <span className="text-sm font-bold text-white">21</span>
      </div>
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-amber-subtle px-3 py-1.5 text-xs font-semibold text-amber">
        <Star className="h-3 w-3" fill="currentColor" />
        Earn XP, level up, climb the board
      </span>
    </div>
  );
}

export function AssistantArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-accent shadow-sm ${compact ? 'p-3.5' : 'p-4'}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm leading-snug text-white">
        &ldquo;Any networking events this weekend?&rdquo; Ask me things like that, anytime.
      </p>
    </div>
  );
}

export function DigestArt() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-paper p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Weekly Recap</p>
        <DigestDateRange />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DIGEST_STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-secondary py-2.5">
            <span className="text-sm font-bold">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
          <MessageCircle className="h-3.5 w-3.5" />
        </div>
        <p className="truncate text-xs font-medium">Best spots to kayak at sunrise?</p>
      </div>
    </div>
  );
}

export const FEATURE_ART: Record<string, () => React.ReactNode> = {
  forum: () => <ForumArt />,
  events: () => <EventsArt />,
  petitions: () => <PetitionArt />,
  missions: () => <MissionsArt />,
  leaderboard: () => <LeaderboardArt />,
  digest: () => <DigestArt />,
  services: () => <ServicesArt />,
  assistant: () => <AssistantArt />,
};
