import { Reveal, RevealScale } from '@/components/motion/reveal';
import { ReelPlayer } from './reel-player';

// Used to be a stylized mockup here (hand-drawn tab bar, no real screenshot)
// since the app was still pre-launch and its UI still moving -- now that
// eLLVate is actually live, the real promo reel (shared on Instagram/TikTok)
// replaces it, since an actual video of the app beats a drawn approximation
// of one.
export function AppPreview() {
  return (
    // border-t only, not border-y -- a bottom border here would draw a hard
    // line right where About's photo/parallax section starts fading in
    // underneath it.
    <section className="border-t border-border/60 bg-surface-subtle/50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See it in action</h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Forum, Events, Missions, Directory, and Petitions — one tap away in the tab
            bar, with the assistant given its own permanent home button in the corner.
            Watch how neighbors are already using eLLVate to connect around Lake Las Vegas.
          </p>
        </Reveal>
        <RevealScale delay={0.1} className="mx-auto w-full max-w-xs">
          <div className="rounded-[2.5rem] border border-border bg-canvas p-3 shadow-2xl shadow-ink/10">
            <ReelPlayer className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-card" />
          </div>
        </RevealScale>
      </div>
    </section>
  );
}
