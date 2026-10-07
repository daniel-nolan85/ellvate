import { DesertGlow } from '@/components/sections/desert-glow';
import { ReelPlayer } from '@/components/sections/reel-player';
import { Wordmark } from '@/components/brand/wordmark';
import { FadeIn } from '@/components/motion/fade-in';
import { AppStoreBadge, GooglePlayBadge } from '@/components/store-badges';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/lib/content';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <DesertGlow />
      {/* lg:grid-cols-2 puts the reel beside the pitch on desktop, where
          there's room for both without pushing the CTA down; it stacks
          below the text on mobile instead of competing with the headline
          for the very first thing seen on a small screen. */}
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-14 pt-20 sm:pt-28 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <FadeIn>
            <Badge>Live now on iOS &amp; Android</Badge>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              The neighborhood,
              <br />
              in one place.
            </h1>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="tagline mt-3 text-xl text-foreground sm:text-2xl">{BRAND.tagline}</p>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
              <Wordmark className="text-foreground text-xl" /> brings {BRAND.community} together - forum discussions, a
              shared events calendar, neighborhood missions, a directory of local
              services and verified businesses, and an assistant that knows the
              community - all in one app.
            </p>
          </FadeIn>
          <FadeIn delay={0.24} className="mt-8 w-full">
            <div
              id="download"
              className="flex scroll-mt-24 flex-col items-center gap-3 sm:flex-row lg:items-start"
            >
              <AppStoreBadge href={BRAND.appStoreUrl} />
              <GooglePlayBadge href={BRAND.playStoreUrl} />
            </div>
          </FadeIn>
        </div>
        <FadeIn delay={0.3} className="mx-auto w-full max-w-xs lg:max-w-sm">
          <div className="rounded-[2.5rem] border border-border bg-canvas p-3 shadow-2xl shadow-ink/10">
            <ReelPlayer className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-card" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
