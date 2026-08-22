import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { BRAND } from '@/lib/content';
import { SITE_URL } from '@/lib/site-url';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang="en" className={inter.variable}>
      <body id="top" className="antialiased">
        {children}
      </body>
    </html>
  );
}
