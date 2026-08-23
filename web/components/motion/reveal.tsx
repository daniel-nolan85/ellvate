'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

// Travels further and takes a touch longer than you'd guess looks right --
// a short slide reads as stiff even with a nice easing curve, since there's
// barely any motion to actually perceive. This distance is tuned to feel
// like a graceful glide into place, not a snap.
const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 72 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

// Same fade/slide as VARIANTS plus a slight scale-up, for art/mockup panels
// specifically (feature-detail.tsx's art panel, the assistant chat demo, the
// phone mockup) -- gives those a touch more physicality than plain text.
const SCALE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 56, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE } },
};

// A large negative bottom margin on the viewport means an element only
// counts as "in view" once it's scrolled well past the bottom edge of the
// screen, not the instant it peeks in -- without this, the animation plays
// out at the very edge of the viewport where it's barely noticed before the
// user's eye reaches it.
const VIEWPORT = { once: true, margin: '0px 0px -220px 0px' } as const;

export function Reveal({
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
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={VARIANTS}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={STAGGER_CONTAINER}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={VARIANTS}>
      {children}
    </motion.div>
  );
}

export function RevealScale({
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
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={SCALE_VARIANTS}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
