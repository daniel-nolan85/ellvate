'use client';

import { useMemo } from 'react';

// Ported from nolancode.com's own nav (SolarIcon + the ".nav-wordmark" rule,
// supplied directly by Daniel) for the footer's "built by" credit. See the
// color-adaptation note above .nolancode-wordmark in globals.css -- the
// wordmark's colors are intentionally not identical to the source site's,
// since that one is styled for a dark nav background and this footer isn't.
function NolancodeOrbitIcon({ size = 20 }: { size?: number }) {
  // Randomized per mount so multiple instances of this icon on screen at
  // once don't all orbit in lockstep -- matches the source component
  // exactly, orbit-delay mismatch between server and client render is
  // cosmetic only.
  const delays = useMemo(() => [-(Math.random() * 8), -(Math.random() * 14)], []);
  const scale = size / 36;

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexShrink: 0,
        height: size,
        justifyContent: 'center',
        position: 'relative',
        transform: 'skewX(-15deg)',
        width: size,
      }}
    >
      <div
        style={{
          background:
            'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(103,232,249,0.8) 50%, rgba(34,211,238,0.3) 100%)',
          borderRadius: '50%',
          boxShadow: `0 0 ${8 * scale}px rgba(103,232,249,0.8), 0 0 ${16 * scale}px rgba(103,232,249,0.4)`,
          height: 14 * scale,
          position: 'absolute',
          width: 14 * scale,
          zIndex: 2,
        }}
      />

      <div
        className="nolancode-orbit"
        style={{
          alignItems: 'flex-start',
          animation: 'nolancode-orbit-spin 8s linear infinite',
          animationDelay: `${delays[0]}s`,
          border: '0.8px solid transparent',
          borderColor:
            'rgba(103,232,249,0.5) rgba(103,232,249,0.1) rgba(103,232,249,0.1) rgba(103,232,249,0.5)',
          borderRadius: '50%',
          display: 'flex',
          height: 26 * scale,
          justifyContent: 'center',
          position: 'absolute',
          width: 26 * scale,
        }}
      >
        <div
          style={{
            background: 'radial-gradient(circle at 35% 35%, #fff, #67E8F9)',
            borderRadius: '50%',
            boxShadow: '0 0 4px rgba(103,232,249,0.9)',
            height: 4 * scale,
            left: '50%',
            marginLeft: -2 * scale,
            marginTop: -2 * scale,
            position: 'absolute',
            top: 0,
            width: 4 * scale,
          }}
        />
      </div>

      <div
        className="nolancode-orbit"
        style={{
          alignItems: 'flex-start',
          animation: 'nolancode-orbit-spin 14s linear infinite',
          animationDelay: `${delays[1]}s`,
          border: '0.8px solid transparent',
          borderColor:
            'rgba(148,163,184,0.35) rgba(148,163,184,0.06) rgba(148,163,184,0.06) rgba(148,163,184,0.35)',
          borderRadius: '50%',
          display: 'flex',
          height: 36 * scale,
          justifyContent: 'center',
          position: 'absolute',
          width: 36 * scale,
        }}
      >
        <div
          style={{
            background: 'radial-gradient(circle at 35% 35%, #e2e8f0, #94A3B8)',
            borderRadius: '50%',
            boxShadow: '0 0 3px rgba(148,163,184,0.7)',
            height: 3.5 * scale,
            left: '50%',
            marginLeft: -1.75 * scale,
            marginTop: -1.75 * scale,
            position: 'absolute',
            top: 0,
            width: 3.5 * scale,
          }}
        />
      </div>
    </div>
  );
}

export function NolancodeLogo({ className, iconSize = 20 }: { className?: string; iconSize?: number }) {
  return (
    <span className={className} style={{ alignItems: 'center', display: 'inline-flex', gap: '0.4rem' }}>
      <NolancodeOrbitIcon size={iconSize} />
      <span className="nolancode-wordmark">
        Nolan<span>code</span>
      </span>
    </span>
  );
}
