import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'eLLVate — Admin',
  description: 'Moderation and content administration for eLLVate.',
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
