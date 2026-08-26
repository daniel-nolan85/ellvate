import { ImageResponse } from 'next/og';

import { BRAND } from '@/lib/content';

// Auto-detected by Next.js (App Router file convention) as the social share
// preview image for every page under this layout -- Facebook/iMessage/Slack
// link unfurls, Twitter cards, etc. No static asset needed; generated at
// build time from the same brand tokens as the rest of the site.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// next/og's ImageResponse (Satori) doesn't pick up next/font the way normal
// pages do -- it needs the actual font binary handed to it. Google's CSS2
// API serves a different font format depending on the request's User-Agent;
// an old browser string gets a plain TrueType file (what Satori needs)
// instead of woff2. `text` subsets the font to only the glyphs actually
// requested, keeping the fetch tiny.
//
// Every text node in this image needs a font from the `fonts` array passed
// to ImageResponse explicitly -- once that array is non-empty, Satori's
// implicit default-font fallback for unstyled text renders duplicated,
// ghosted glyphs instead of just falling back cleanly. So this loads Inter
// (the site's own body font) for the subtitle too, rather than leaving it
// to fall back.
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
  const css = await (
    await fetch(cssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
      },
    })
  ).text();

  const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) {
    throw new Error(`Could not find a font URL in the Google Fonts CSS response for ${family}.`);
  }

  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(`Font fetch failed for ${family} with status ${fontResponse.status}.`);
  }
  return fontResponse.arrayBuffer();
}

export default async function Image() {
  const subtitle = `The ${BRAND.community} neighborhood app`;
  const [ryeFont, interFont] = await Promise.all([
    loadGoogleFont('Rye', BRAND.appName),
    loadGoogleFont('Inter', subtitle),
  ]);

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
            fontSize: 76,
            fontFamily: 'Rye',
            color: '#251e17',
          }}
        >
          {/* Hardcoded to eLLVate's literal spelling, same as the cactus
              glyph below being hand-built rather than derived from
              CactusMark -- both need a manual look if BRAND.appName
              ever changes. */}
          <span>e</span>
          <span style={{ color: '#2f6e72' }}>LLV</span>
          <span>ate</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 16,
            fontSize: 30,
            fontFamily: 'Inter',
            color: '#786c5e',
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Rye', data: ryeFont, style: 'normal', weight: 400 },
        { name: 'Inter', data: interFont, style: 'normal', weight: 400 },
      ],
    }
  );
}
