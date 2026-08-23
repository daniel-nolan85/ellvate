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
                {BRAND.community} is more than a place to live. It&apos;s a community
                full of people, businesses, events, ideas, and experiences, and{' '}
                {BRAND.appName} is built to bring all of that closer together.
              </p>
              <p>
                Instead of piecing things together across group chats, Facebook posts,
                flyers, and word of mouth, you can find what&apos;s happening, discover
                local businesses, connect with your neighbors, join community activities,
                and have a voice in the things that matter, all in one place.
              </p>
              <p>
                And because it&apos;s built specifically for {BRAND.community}, it
                isn&apos;t a generic neighborhood app with our name slapped on it. The
                features are shaped around life here: from marina mornings and local
                events to HOA meetings, community discussions, missions, and the
                businesses that make the Village what it is.
              </p>
              <p>
                Best of all, it&apos;s built for everyone. {BRAND.appName} is free for
                residents, with tools like Petitions giving neighbors an easy way to come
                together and make their voices heard.
              </p>
              <p className="text-lg font-medium text-foreground">
                One community. One place to connect. Built by your neighbors, for{' '}
                {BRAND.community}.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
