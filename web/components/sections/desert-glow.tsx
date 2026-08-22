'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Split out of hero.tsx specifically so hero.tsx itself can stay a Server
// Component -- it imports WaitlistForm through the modules/waitlist barrel,
// which also re-exports a server-only function (joinWaitlist); barrel
// imports like that only work from a Server Component. Only this piece
// needs the client-side scroll tracking.
export function DesertGlow() {
  const ref = useRef<HTMLDivElement>(null);
  // Tracks scroll only across the hero's own height, so the dune drifts as
  // you arrive and settles once you've scrolled past it, rather than
  // tracking the whole page.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const duneY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(55%_55%_at_50%_10%,theme(colors.amber/0.20),transparent)]" />
      {/* Faint drifting grain -- a nod to blown sand rather than a static
          gradient. Opacity kept very low (3%) so it reads as texture, not
          decoration you consciously notice. */}
      <div
        aria-hidden
        className="animate-sand-drift absolute inset-0 opacity-[0.03] [background-image:radial-gradient(circle,theme(colors.ink)_1px,transparent_1px)] [background-size:26px_26px]"
      />
      <motion.svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        width="1200"
        height="200"
        style={{ y: duneY }}
        className="absolute inset-x-0 bottom-0 h-40 w-full text-surface-subtle"
      >
        <path d="M0,120 C300,40 900,200 1200,80 L1200,200 L0,200 Z" fill="currentColor" opacity="0.6" />
      </motion.svg>
    </div>
  );
}
