import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { ICONS } from '@/lib/icons';
import { features } from '@/lib/content';

const ACCENT_TEXT: Record<string, string> = {
  accent: 'text-accent',
  amber: 'text-amber',
  lake: 'text-lake',
  palm: 'text-palm',
  plum: 'text-plum',
};

const ACCENT_BG: Record<string, string> = {
  accent: 'bg-accent-subtle',
  amber: 'bg-amber-subtle',
  lake: 'bg-lake-subtle',
  palm: 'bg-palm-subtle',
  plum: 'bg-plum-subtle',
};

export function FeatureOverview() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 pt-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything the community needs
        </h2>
        <p className="mt-4 text-muted-foreground">
          One app for what&apos;s happening, who&apos;s around, and how to get involved.
          Jump to any of it below.
        </p>
      </Reveal>
      <RevealGroup className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {features.map((feature) => {
          const Icon = ICONS[feature.icon];
          return (
            <RevealItem key={feature.id}>
              <a
                href={`#${feature.id}`}
                className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-card px-4 py-6 text-center no-underline transition-colors hover:border-accent/40"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[250%] -skew-x-12 bg-gradient-to-r from-transparent via-accent/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[350%]"
                />
                <div
                  className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-6 group-hover:scale-110 ${ACCENT_BG[feature.accent]} ${ACCENT_TEXT[feature.accent]}`}
                >
                  {Icon ? <Icon className="h-5 w-5" /> : null}
                </div>
                <span className="relative z-10 text-sm font-medium">{feature.title}</span>
              </a>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
