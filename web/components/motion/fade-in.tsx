'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

// Plain mount-triggered fade, not the scroll-triggered <Reveal>/<RevealGroup>
// used everywhere else on the page -- for above-the-fold content (the hero)
// that needs to just be there on load, not wait for an IntersectionObserver
// that may not fire until the user scrolls (Reveal's viewport margin is
// tuned for content further down the page).
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
