import { Reveal } from '@/components/motion/reveal';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/lib/content';
import { WaitlistForm } from '@/modules/waitlist';

export function Hero() {
  return (
    <section id="waitlist" className="relative overflow-hidden">
      <DesertGlow />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-20 text-center sm:pt-28">
        <Reveal>
          <Badge>Coming soon to iOS &amp; Android</Badge>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            The neighborhood,
            <br />
            in one place.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
            {BRAND.appName} brings {BRAND.community} together — forum discussions, a
            shared events calendar, neighborhood missions, a local services directory,
            and an assistant that knows the community — all in one app.
          </p>
        </Reveal>
        <Reveal delay={0.24} className="w-full max-w-md">
          <WaitlistForm className="mt-10 w-full" />
          <p className="mt-4 text-xs text-muted-foreground">
            No spam. We&apos;ll only email you when the app is ready.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function DesertGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(55%_55%_at_50%_10%,theme(colors.amber/0.20),transparent)]" />
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        width="1200"
        height="200"
        className="absolute inset-x-0 bottom-0 h-40 w-full text-surface-subtle"
      >
        <path d="M0,120 C300,40 900,200 1200,80 L1200,200 L0,200 Z" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
}
