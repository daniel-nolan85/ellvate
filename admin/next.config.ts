import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Nothing but service-role Supabase calls happens on the server; keep
  // this app server-rendered rather than statically exported.
  reactStrictMode: true,
  // Without this, Next.js infers the workspace root by walking up for the
  // nearest lockfile and lands on the sibling Expo app's package-lock.json
  // (a stray file from `expo install`, not an intended workspace) --
  // pinning it here keeps this app's build fully scoped to admin/.
  outputFileTracingRoot: path.join(__dirname),
  // The dev-mode build-activity indicator (pulsing corner logo) is on
  // screen constantly regardless of whether anything is actually loading --
  // route-level loading.tsx gives a real, page-scoped loading signal instead.
  devIndicators: false,
};

export default nextConfig;
