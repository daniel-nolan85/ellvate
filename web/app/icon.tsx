import { ImageResponse } from 'next/og';

// A simplified silhouette of the real cactus mark
// (components/brand/cactus-mark.tsx) on a solid terracotta tile -- cream on
// terracotta stays legible at 32px in a way the mark's own sage-on-nothing
// wouldn't, and a favicon this small can't carry the full detail
// (sunglasses, spikes). The crown band is the one extra cue kept from the
// full mark since it's the glyph's most identifying feature.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#b5502c',
          borderRadius: 7,
        }}
      >
        <div style={{ display: 'flex', position: 'relative', width: 18, height: 24 }}>
          {/* crown band */}
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: 0,
              width: 6,
              height: 3,
              borderRadius: 1.5,
              background: '#e6b93c',
            }}
          />
          {/* trunk */}
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: 2,
              width: 6,
              height: 22,
              borderRadius: 3,
              background: '#fdf7ed',
            }}
          />
          {/* left arm -- lower, per the full mark's asymmetry */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 7,
              width: 5,
              height: 10,
              borderRadius: 2.5,
              background: '#fdf7ed',
            }}
          />
          {/* right arm -- higher, per the full mark's asymmetry */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 3,
              width: 5,
              height: 10,
              borderRadius: 2.5,
              background: '#fdf7ed',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
