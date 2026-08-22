import { DesertGlow } from '@/components/sections/desert-glow';
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
