'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

import { Reveal } from '@/components/motion/reveal';
import { BRAND } from '@/lib/content';

// Real aerial photo of Lake Las Vegas -- public domain (Library of Congress,
// Carol M. Highsmith Archive, no known copyright restrictions; see
// public/lake-las-vegas-aerial.jpg's provenance in the conversation this was
// sourced from, 2026-08-21). The text sits in a solid card rather than
// directly on the photo with a scrim, so it stays fully legible while the
// photo itself -- and the parallax drift -- stays genuinely visible around
// the edges instead of being washed out underneath it.
export function About() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-12%', '12%']);

  return (
    <section id="about" ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <motion.div aria-hidden className="absolute -inset-y-[15%] inset-x-0 -z-20" style={{ y }}>
        <Image
          src="/lake-las-vegas-aerial.jpg"
          alt="Aerial view of Lake Las Vegas, with MonteLago Village and the marina along the shoreline"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas via-canvas/30 to-canvas"
      />

      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal>
          <div className="rounded-3xl border border-border/50 bg-paper/95 p-8 text-center shadow-xl backdrop-blur-sm sm:p-12">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for {BRAND.community}
            </h2>
            <div className="mx-auto mt-6 max-w-2xl space-y-5 text-muted-foreground">
              <p>
                {BRAND.community} is a tight-knit community, but staying in the loop has
                always meant piecing it together — a group chat here, a flyer there, a
                recommendation you half-remember from someone at the marina.{' '}
                {BRAND.appName} puts it all in one place: what&apos;s being talked about,
                what&apos;s coming up, who&apos;s worth calling for a repair, and easy
                ways to get out and actually be part of it.
              </p>
              <p>
                It&apos;s built specifically for this community, not a generic app
                reskinned for every neighborhood in the country. The forum channels, the
                missions, the local services directory — all of it is shaped around what
                actually happens here, from marina mornings to HOA meetings, not some
                average of every suburb everywhere.
              </p>
              <p>
                And it&apos;s built with the same care we&apos;d want as neighbors
                ourselves: free for every resident, with features like Petitions designed
                to give people a real way to be heard.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
