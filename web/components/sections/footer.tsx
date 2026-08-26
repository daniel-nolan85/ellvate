import { CactusMark } from '@/components/brand/cactus-mark';
import { NolancodeLogo } from '@/components/brand/nolancode-logo';
import { Wordmark } from '@/components/brand/wordmark';
import { CopyrightYear } from '@/components/copyright-year';
import { Reveal } from '@/components/motion/reveal';
import { BRAND } from '@/lib/content';
import { WaitlistForm } from '@/modules/waitlist';

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Be first to know</h2>
          <p className="mt-4 text-muted-foreground">
            <Wordmark className="text-foreground text-lg" /> is launching soon on iOS and Android.
          </p>
          <WaitlistForm className="mx-auto mt-8 max-w-md" />
        </Reveal>
      </div>
      <div className="border-t border-white/10 bg-[#080c10]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-white/70 sm:flex-row">
          <div className="flex items-center gap-2">
            <CactusMark animated className="h-6 w-6" />
            <span className="flex items-center gap-1.5">
              <Wordmark className="text-base" />
              <span>
                &middot; &copy; <CopyrightYear />
              </span>
            </span>
          </div>
          <a href={BRAND.companyUrl} target="_blank" rel="noopener noreferrer" aria-label={BRAND.company}>
            <NolancodeLogo iconSize={16} variant="dark" />
          </a>
          <div className="flex items-center gap-4">
            <a href="/terms" className="underline-offset-2 hover:text-white hover:underline">
              Terms
            </a>
            <a href="/privacy" className="underline-offset-2 hover:text-white hover:underline">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
