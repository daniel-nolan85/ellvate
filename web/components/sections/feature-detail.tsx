import { Check } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem, RevealScale } from '@/components/motion/reveal';
import { ICONS } from '@/lib/icons';
import { businessCategories, serviceCategories, type Feature } from '@/lib/content';

import { FEATURE_ART } from './feature-art';

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

// Renders every feature except 'assistant', which gets its own standout
// treatment (components/sections/assistant-showcase.tsx) instead of this
// standard alternating layout.
export function FeatureDetail({ feature, reversed }: { feature: Feature; reversed: boolean }) {
  const Icon = ICONS[feature.icon];

  return (
    <section
      id={feature.id}
      className="scroll-mt-24 py-12 sm:py-16"
    >
      <div
        className={`mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16 ${
          reversed ? 'lg:[&>*:first-child]:order-2' : ''
        }`}
      >
        <Reveal>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${ACCENT_BG[feature.accent]} ${ACCENT_TEXT[feature.accent]}`}>
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {feature.title}
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{feature.hook}</h3>
          <p className="mt-4 text-muted-foreground">{feature.description}</p>
          <ul className="mt-6 space-y-3">
            {feature.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5 text-sm">
                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${ACCENT_TEXT[feature.accent]}`} />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
            {feature.goodFor}
          </p>
        </Reveal>

        {feature.id === 'directory' ? (
          <div className="space-y-3">
            <ServiceCategoryGrid />
            <BusinessCategoryGrid />
          </div>
        ) : (
          <RevealScale delay={0.1}>
            <FeatureArtPanel feature={feature} />
          </RevealScale>
        )}
      </div>
    </section>
  );
}

function FeatureArtPanel({ feature }: { feature: Feature }) {
  const art = FEATURE_ART[feature.id];
  return (
    <div className={`flex items-center justify-center rounded-2xl p-8 sm:p-10 ${ACCENT_BG[feature.accent]}`}>
      <div className="w-full max-w-sm">{art ? art() : null}</div>
    </div>
  );
}

function ServiceCategoryGrid() {
  return (
    <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
      {serviceCategories.map((category) => {
        const Icon = ICONS[category.icon];
        return (
          <RevealItem key={category.label}>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lake-subtle text-lake">
                {Icon ? <Icon className="h-5 w-5" /> : null}
              </div>
              <span className="text-xs font-medium">{category.label}</span>
            </div>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}

// The Businesses side's own category grid, right below ServiceCategoryGrid's
// Services one, in the same card style -- the two categorized lists side by
// side make it clear Directory really does hold two distinct sections.
function BusinessCategoryGrid() {
  return (
    <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
      {businessCategories.map((category) => {
        const Icon = ICONS[category.icon];
        return (
          <RevealItem key={category.label}>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lake-subtle text-lake">
                {Icon ? <Icon className="h-5 w-5" /> : null}
              </div>
              <span className="text-xs font-medium">{category.label}</span>
            </div>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}
