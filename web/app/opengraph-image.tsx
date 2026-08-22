import { ImageResponse } from 'next/og';

import { BRAND } from '@/lib/content';

// Auto-detected by Next.js (App Router file convention) as the social share
// preview image for every page under this layout -- Facebook/iMessage/Slack
// link unfurls, Twitter cards, etc. No static asset needed; generated at
// request time from the same brand tokens as the rest of the site.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f1e6',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 96,
            height: 96,
            borderRadius: 24,
            background: '#b5502c',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', position: 'relative', width: 40, height: 55 }}>
            <div
              style={{
                position: 'absolute',
                left: 13,
                top: 0,
                width: 15,
                height: 55,
                borderRadius: 7,
                background: '#fdf7ed',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 15,
                width: 13,
                height: 24,
                borderRadius: 6,
                background: '#fdf7ed',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 5,
                width: 13,
                height: 24,
                borderRadius: 6,
                background: '#fdf7ed',
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: '#251e17',
          }}
        >
          {BRAND.appName}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 16,
            fontSize: 30,
            color: '#786c5e',
          }}
        >
          The {BRAND.community} neighborhood app
        </div>
      </div>
    ),
    { ...size }
  );
}
