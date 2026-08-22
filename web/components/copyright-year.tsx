'use client';

import { useEffect, useState } from 'react';

// The page this renders on is statically generated, so a plain
// `new Date().getFullYear()` in a server component would freeze at whatever
// year the site was last deployed in. Reading the client's own clock after
// mount keeps it correct indefinitely between deploys. Starts blank rather
// than seeding from the server's build-time year, so there's no
// server/client render mismatch to reconcile during hydration.
export function CopyrightYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return <>{year}</>;
}
