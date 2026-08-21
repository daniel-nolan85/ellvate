import { ImageResponse } from 'next/og';

// Generated placeholder favicon -- a simplified silhouette of the same
// cactus mark used as the temporary logo (components/brand/cactus-mark.tsx)
// on a solid terracotta tile, since a favicon this small can't carry the
// full detail (sunglasses, spikes). Swap for a real icon once the actual
// logo design lands.
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
        <div style={{ display: 'flex', position: 'relative', width: 16, height: 22 }}>
          <div
            style={{
              position: 'absolute',
              left: 5,
              top: 0,
              width: 6,
              height: 22,
              borderRadius: 3,
              background: '#fdf7ed',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 6,
              width: 5,
              height: 10,
              borderRadius: 2.5,
              background: '#fdf7ed',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 2,
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
