import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'LLV Community — Admin',
  description: 'Moderation and content administration for LLV Community.',
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
