import { CactusMark } from '@/components/brand/cactus-mark';
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
            {BRAND.appName} is launching soon on iOS and Android.
          </p>
          <WaitlistForm className="mx-auto mt-8 max-w-md" />
        </Reveal>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <CactusMark className="h-5 w-5" />
            <span>{BRAND.appName}</span>
          </div>
          <span>
            &copy; <CopyrightYear /> {BRAND.appName}. A{' '}
            <a
              href={BRAND.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {BRAND.company}
            </a>{' '}
            product.
          </span>
        </div>
      </div>
    </footer>
  );
}
