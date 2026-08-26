'use client';

import * as React from 'react';
import { Menu, X } from 'lucide-react';

import { CactusMark } from '@/components/brand/cactus-mark';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/content';

// Services isn't its own nav link -- it's one of the features, reachable
// from the Features overview strip (#features) like any other, so listing
// it again here was redundant.
const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#about', label: 'About' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
];

const SECTION_IDS = LINKS.map((link) => link.href.slice(1));

// Plain <a> tags, not next/link -- these are same-page hash jumps, and
// next/link's client-side routing doesn't reliably trigger the browser's
// native (CSS `scroll-behavior: smooth`-driven) scroll-to-anchor when the
// pathname isn't actually changing.
export function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // While true, the IntersectionObserver's own updates are ignored -- set
  // on nav-link click so the highlight jumps straight to the clicked
  // section instead of visibly stepping through every section the smooth
  // scroll passes on the way there. Cleared once the scroll actually stops.
  const suppressSpyRef = React.useRef(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    let fallbackTimer: number | undefined;
    const clearSuppress = () => {
      suppressSpyRef.current = false;
      window.clearTimeout(fallbackTimer);
    };
    // scrollend has broad support now, but a fallback timer guards the rare
    // case a click doesn't actually change scroll position (already there)
    // and no scroll/scrollend event fires at all.
    window.addEventListener('scrollend', clearSuppress);
    return () => {
      window.removeEventListener('scrollend', clearSuppress);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  React.useEffect(() => {
    // Anchored to the strip right under the sticky header (top: -64px, the
    // nav's own height) rather than a band partway down the viewport -- a
    // section only counts as "active" once you've actually scrolled to it,
    // not the moment it peeks in from the bottom of a tall viewport (which
    // was misreporting Features as active while still on the hero).
    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressSpyRef.current) {
          return;
        }
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) {
          return;
        }
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveId(topmost.target.id);
      },
      { rootMargin: '-64px 0px -75% 0px', threshold: 0 }
    );

    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleLinkClick = (id: string) => {
    suppressSpyRef.current = true;
    setActiveId(id);
    setMobileOpen(false);
    // Fallback in case neither `scroll` nor `scrollend` fires (e.g. already
    // at the target).
    window.setTimeout(() => {
      suppressSpyRef.current = false;
    }, 1200);
  };

  // "Join the waitlist" should land the visitor in the input ready to type,
  // not just scroll the section into view. focus() has to happen
  // synchronously, in the same tick as the tap -- mobile browsers only pop
  // the on-screen keyboard when focus is a direct result of a user gesture,
  // and calling it inside a setTimeout (even a short one) loses that, moving
  // the cursor with no keyboard. scrollIntoView comes after so the input
  // ends up nicely centered on top of whatever native scroll-into-view the
  // keyboard's own appearance triggers.
  const handleWaitlistCtaClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setMobileOpen(false);
    const input = document.getElementById('hero-waitlist-email');
    if (!(input instanceof HTMLElement)) {
      return;
    }
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-canvas/85 backdrop-blur transition-shadow duration-300 ${
        scrolled ? 'border-border/60 shadow-sm' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
          <CactusMark animated className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-wide">{BRAND.appName}</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {LINKS.map((link) => {
            const id = link.href.slice(1);
            const isActive = activeId === id;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => handleLinkClick(id)}
                className={`relative py-1 no-underline transition-colors ${
                  isActive ? 'text-foreground' : 'hover:text-foreground'
                }`}
              >
                {link.label}
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 left-0 h-[1.5px] w-full origin-left scale-x-0 bg-accent transition-transform duration-300 ${
                    isActive ? 'scale-x-100' : ''
                  }`}
                />
              </a>
            );
          })}
        </nav>
        <Button asChild size="sm" className="hidden lg:inline-flex">
          <a href="#waitlist" onClick={handleWaitlistCtaClick}>
            Join the waitlist
          </a>
        </Button>
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <nav className="border-t border-border/60 bg-canvas px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => {
              const id = link.href.slice(1);
              const isActive = activeId === id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => handleLinkClick(id)}
                  className={`rounded-md px-2 py-2.5 text-sm no-underline transition-colors ${
                    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
          <Button asChild size="sm" className="mt-3 w-full">
            <a href="#waitlist" onClick={handleWaitlistCtaClick}>
              Join the waitlist
            </a>
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
