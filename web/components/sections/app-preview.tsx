import { CalendarDays, FileSignature, MessageCircle, Sparkles, Star, Store } from 'lucide-react';

import { Reveal, RevealScale } from '@/components/motion/reveal';

// A stylized mockup, not a literal screenshot -- the app is still pre-launch
// and its UI is still moving. Mirrors the real nav exactly
// (../../../src/modules/community-shell/floating-tab-bar.tsx +
// assistant-button.tsx): five equal tabs -- Forum, Events, Missions,
// Services, Petitions -- in the dark pill, with the assistant as a separate
// glowing button that floats above it in the bottom right, mounted once at
// the root layout rather than living inside the tab bar. No "Ranks" tab --
// the leaderboard isn't in the tab bar, it lives elsewhere.
export function AppPreview() {
  return (
    // border-t only, not border-y -- a bottom border here would draw a hard
    // line right where About's photo/parallax section starts fading in
    // underneath it.
    <section className="border-t border-border/60 bg-surface-subtle/50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A closer look</h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Forum, Events, Missions, Services, and Petitions — one tap away in the tab
            bar, with the assistant given its own permanent home button in the corner.
            Built to feel like it belongs on your phone from day one.
          </p>
        </Reveal>
        <RevealScale delay={0.1} className="mx-auto w-full max-w-xs">
          <PhoneMockup />
        </RevealScale>
      </div>
    </section>
  );
}

const TABS = [
  { label: 'Forum', icon: MessageCircle },
  { label: 'Events', icon: CalendarDays },
  { label: 'Missions', icon: Star },
  { label: 'Services', icon: Store },
  { label: 'Petitions', icon: FileSignature },
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

        {/* Floats above the tab bar, bottom-right -- matches app/_layout.tsx's
            AssistantButton positioning (tab bar height + gap, right: 16). */}
        <div className="absolute bottom-[76px] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent shadow-[0_4px_10px_-2px_theme(colors.accent/0.6)]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>

        <div className="absolute inset-x-3 bottom-3 flex h-14 items-center justify-between rounded-full bg-ink px-1.5 shadow-lg">
          {TABS.map(({ label, icon: Icon }) => (
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
