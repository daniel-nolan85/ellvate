import type { Metadata } from 'next';
import { Fraunces, Inter, Rye } from 'next/font/google';

import { BRAND } from '@/lib/content';
import { SITE_URL } from '@/lib/site-url';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// The wordmark ("eLLVate" in the nav/footer/legal-page header) and the
// hero tagline -- both scoped to those specific marketing moments via the
// .wordmark/.tagline classes in globals.css, not used for body copy or UI.
const rye = Rye({ subsets: ['latin'], weight: '400', variable: '--font-rye' });
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['italic'],
  variable: '--font-fraunces',
});

const title = `${BRAND.appName} — The ${BRAND.community} neighborhood app`;
const description = `${BRAND.appName} brings ${BRAND.community} together in one app: forum discussions, an events calendar, neighborhood missions, a local services directory, a leaderboard, and an AI assistant that knows the community. Coming soon to iOS and Android.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: [
    'Lake Las Vegas',
    'Lake Las Vegas app',
    'Lake Las Vegas community',
    'Henderson Nevada community app',
    'HOA app',
    'neighborhood app',
  ],
  openGraph: {
    title,
    description,
    url: '/',
    siteName: BRAND.appName,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${rye.variable} ${fraunces.variable}`}>
      <body id="top" className="antialiased">
        {children}
      </body>
    </html>
  );
}
