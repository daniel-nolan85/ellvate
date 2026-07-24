export type CategoryAccent = 'accent' | 'amber' | 'lake' | 'palm' | 'muted';

// Only categories that genuinely mean "water" or "nature" get colored — a tag
// like "Buy & Sell" or "Networking" doesn't carry any of that meaning, so it
// stays a quiet neutral rather than being forced into a color for its own
// sake. Announcements and HOA get the primary accent since they're both
// "official" channels; Dining gets amber (warmth). Everything else defaults
// to muted.
const WATER_CATEGORIES = new Set(['Marina & Boating']);
const NATURE_CATEGORIES = new Set(['Trails', 'Outdoors', 'Golf']);
const DINING_CATEGORIES = new Set(['Dining']);
const OFFICIAL_CATEGORIES = new Set(['Announcements', 'HOA']);

export function categoryAccent(category: string): CategoryAccent {
  if (WATER_CATEGORIES.has(category)) {
    return 'lake';
  }
  if (NATURE_CATEGORIES.has(category)) {
    return 'palm';
  }
  if (DINING_CATEGORIES.has(category)) {
    return 'amber';
  }
  if (OFFICIAL_CATEGORIES.has(category)) {
    return 'accent';
  }
  return 'muted';
}

// Shared "selected chip" tint/text pairing for anywhere a category is picked
// or filtered by (subforum filter chips, the post composer's category
// picker) — keeps both surfaces reading as the same color language. Neutral
// ("muted") categories use a plum tint rather than repeating the terracotta
// `accent` color that Announcements/HOA already use for "official channel"
// — Buy & Sell, Events, Sports Club, etc. get their own hue instead of every
// uncategorized tag looking the same shade of brown.
//
// WHY arbitrary-value classes (bg-[rgb(...)]) instead of a named
// tailwind.config.js token like the other four accents: NativeWind compiles
// theme.extend.colors once when the dev server boots, so a brand-new named
// color needs a full server restart before it renders (it silently applies
// as "no style" until then) — arbitrary values are picked up from source
// directly, same as any other class name, and need no config/restart step.
//
// These must stay as literal strings, not built from a shared constant via
// template-literal interpolation (e.g. `bg-[${PLUM}]`) — Tailwind/NativeWind's
// class scanner only recognizes exact class-name substrings as they appear
// in the source text; it can't evaluate an interpolated variable, so an
// assembled class name silently produces no style at all, same symptom as
// the config-restart issue but with no restart able to fix it.
export const CATEGORY_CHIP_ACTIVE_TREATMENT: Readonly<
  Record<CategoryAccent, { readonly bg: string; readonly text: string }>
> = {
  accent: { bg: 'bg-accent-subtle', text: 'text-accent' },
  amber: { bg: 'bg-amber-subtle', text: 'text-amber' },
  lake: { bg: 'bg-lake-subtle', text: 'text-lake' },
  muted: { bg: 'bg-[rgb(241,232,238)]', text: 'text-[rgb(139,90,120)]' },
  palm: { bg: 'bg-palm-subtle', text: 'text-palm' },
};
