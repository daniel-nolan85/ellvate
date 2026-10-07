import type { ReactNode } from 'react';

// Standard "Download on the App Store" / "Get it on Google Play" badge
// buttons -- a dedicated component rather than the generic <Button> here,
// since the two-line label + brand mark layout doesn't fit that component's
// single-line shape. Dark pill in the site's own `ink` token (not a flat
// black) to match the brand palette used everywhere else on the page.

function AppleMark() {
  return (
    <svg aria-hidden className="h-6 w-6 shrink-0" fill="white" viewBox="0 0 24 24">
      <path d="M17.05 12.536c-.03-2.99 2.445-4.428 2.556-4.497-1.393-2.037-3.56-2.316-4.33-2.35-1.844-.187-3.6 1.086-4.535 1.086-.936 0-2.378-1.06-3.91-1.03-2.012.03-3.868 1.17-4.903 2.97-2.09 3.624-.534 8.99 1.502 11.93 1 1.44 2.19 3.05 3.75 2.99 1.505-.06 2.073-.97 3.892-.97 1.818 0 2.33.97 3.92.94 1.62-.03 2.646-1.47 3.634-2.92.98-1.46 1.457-2.86 1.49-2.93-.033-.015-2.853-1.096-2.886-4.34" />
      <path d="M14.32 3.89c.825-1 1.38-2.39 1.228-3.77-1.186.05-2.62.79-3.47 1.79-.763.88-1.432 2.3-1.253 3.65 1.32.1 2.67-.67 3.495-1.67" />
    </svg>
  );
}

function GooglePlayMark() {
  return (
    <svg aria-hidden className="h-6 w-6 shrink-0" viewBox="0 0 24 24">
      <path d="M5 3L5 21L14 12Z" fill="#00c3ff" />
      <path d="M5 3L14 12L19 9.5Z" fill="#32d74b" />
      <path d="M5 21L14 12L19 14.5Z" fill="#ff4d4d" />
      <path d="M14 12L19 9.5L21 10.7a1.5 1.5 0 0 1 0 2.6L19 14.5Z" fill="#ffd60a" />
    </svg>
  );
}

function StoreBadge({
  href,
  mark,
  overline,
  title,
}: {
  readonly href: string;
  readonly mark: ReactNode;
  readonly overline: string;
  readonly title: string;
}) {
  return (
    <a
      className="inline-flex h-14 items-center gap-2.5 rounded-xl bg-ink px-4 text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_theme(colors.ink/0.4)]"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {mark}
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-white/80">{overline}</span>
        <span className="-mt-0.5 text-[17px] font-semibold">{title}</span>
      </span>
    </a>
  );
}

export function AppStoreBadge({
  className,
  href,
}: {
  readonly className?: string;
  readonly href: string;
}) {
  return (
    <div className={className}>
      <StoreBadge href={href} mark={<AppleMark />} overline="Download on the" title="App Store" />
    </div>
  );
}

export function GooglePlayBadge({
  className,
  href,
}: {
  readonly className?: string;
  readonly href: string;
}) {
  return (
    <div className={className}>
      <StoreBadge href={href} mark={<GooglePlayMark />} overline="GET IT ON" title="Google Play" />
    </div>
  );
}
