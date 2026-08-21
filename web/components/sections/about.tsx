import { Reveal } from '@/components/motion/reveal';
import { BRAND } from '@/lib/content';

export function About() {
  return (
    <section id="about" className="mx-auto max-w-4xl px-6 py-24">
      <Reveal className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Built for {BRAND.community}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
          {BRAND.community} is a tight-knit community, but staying in the loop has
          always meant piecing it together — a group chat here, a flyer there, a
          recommendation you half-remember from someone at the marina. {BRAND.appName}
          {' '}puts it all in one place: what&apos;s being talked about, what&apos;s
          coming up, who&apos;s worth calling for a repair, and easy ways to get out
          and actually be part of it.
        </p>
      </Reveal>
    </section>
  );
}
