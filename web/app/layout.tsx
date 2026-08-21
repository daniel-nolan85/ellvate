import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { BRAND } from '@/lib/content';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: `${BRAND.appName} — The ${BRAND.community} neighborhood app`,
  description: `${BRAND.appName} brings ${BRAND.community} together in one app: forum discussions, an events calendar, neighborhood missions, a local services directory, a leaderboard, and an AI assistant that knows the community. Coming soon to iOS and Android.`,
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
