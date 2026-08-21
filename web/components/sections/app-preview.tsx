import { CalendarDays, MessageCircle, Sparkles, Star, Store } from 'lucide-react';

import { Reveal } from '@/components/motion/reveal';

// A stylized mockup, not a literal screenshot -- the app is still pre-launch
// and its UI is still moving. The tab bar below mirrors the real one
// (../../../src/modules/community-shell/floating-tab-bar.tsx) exactly:
// Forum, Events, a raised center Assistant button, Missions, Services --
// there's no "Ranks" tab in the app (the leaderboard lives elsewhere), and
// the assistant is a deliberately prominent floating button, not a small
// tab icon like the rest.
export function AppPreview() {
  return (
    <section className="border-y border-border/60 bg-surface-subtle/50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A closer look</h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            The forum, the events calendar, your missions, and local services — one tap
            away, with the assistant given its own prominent home button front and
            center. Built to feel like it belongs on your phone from day one.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mx-auto w-full max-w-xs">
          <PhoneMockup />
        </Reveal>
      </div>
    </section>
  );
}

const LEFT_TABS = [
  { label: 'Forum', icon: MessageCircle },
  { label: 'Events', icon: CalendarDays },
];

const RIGHT_TABS = [
  { label: 'Missions', icon: Star },
  { label: 'Services', icon: Store },
];

function PhoneMockup() {
  return (
    <div className="rounded-[2.5rem] border border-border bg-canvas p-3 shadow-2xl shadow-ink/10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="h-2 w-16 rounded-full bg-surface-subtle" />
          <div className="h-2 w-2 rounded-full bg-surface-subtle" />
        </div>
        <div className="space-y-3 px-5 pb-24">
          <div className="h-24 rounded-xl bg-gradient-to-br from-accent/25 to-amber/10" />
          <div className="h-3 w-2/3 rounded-full bg-surface-subtle" />
          <div className="h-3 w-1/2 rounded-full bg-surface-subtle" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-16 rounded-lg bg-surface-subtle" />
            <div className="h-16 rounded-lg bg-surface-subtle" />
          </div>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex h-14 items-center rounded-full bg-ink px-2 shadow-lg">
          {LEFT_TABS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-0.5 text-canvas/45">
              <Icon className="h-4 w-4" />
              <span className="text-[7px]">{label}</span>
            </div>
          ))}
          <div className="mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent shadow-[0_4px_10px_-2px_theme(colors.accent/0.6)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {RIGHT_TABS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-0.5 text-canvas/45">
              <Icon className="h-4 w-4" />
              <span className="text-[7px]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
