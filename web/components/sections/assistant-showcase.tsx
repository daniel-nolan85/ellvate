import { Sparkles } from 'lucide-react';

import { Reveal } from '@/components/motion/reveal';
import { type Feature } from '@/lib/content';

const EXCHANGES = [
  { from: 'user' as const, text: 'Any events happening this weekend?' },
  {
    from: 'assistant' as const,
    text: "Yes — the Locals Networking Mixer is Friday at 6:30 PM at MonteLago Village. Want me to remind you?",
  },
  { from: 'user' as const, text: "What's a good spot for dinner tonight?" },
  {
    from: 'assistant' as const,
    text: 'Lakeside Bistro is highly rated by neighbors (4.8 stars) and does dinner reservations — want the number?',
  },
];

// The AI Assistant gets a deliberately different, more dramatic treatment
// than the other features (components/sections/feature-detail.tsx) -- it's
// the feature expected to make the biggest first impression, especially for
// residents less used to AI products, so it's shown as a concrete,
// friendly example conversation rather than a bullet list.
export function AssistantShowcase({ feature }: { feature: Feature }) {
  return (
    <section
      id={feature.id}
      className="scroll-mt-24 border-t border-border/60 bg-ink py-20 text-canvas sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber">
            <Sparkles className="h-3.5 w-3.5" />
            AI Assistant
          </div>
          <h3 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {feature.hook}
          </h3>
          <p className="mt-5 text-lg text-canvas/70">{feature.description}</p>
          <ul className="mt-7 space-y-3">
            {feature.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5 text-sm text-canvas/80">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.12}>
          <ChatDemo />
        </Reveal>
      </div>
    </section>
  );
}

function ChatDemo() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 sm:p-6">
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold">Ask the community</span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {EXCHANGES.map((exchange, index) => (
          <div key={index} className={`flex ${exchange.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                exchange.from === 'user'
                  ? 'bg-white/10 text-canvas'
                  : 'bg-accent text-white'
              }`}
            >
              {exchange.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
