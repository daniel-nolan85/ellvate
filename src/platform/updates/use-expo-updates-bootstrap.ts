import { useEffect } from 'react';

import { bootstrapExpoUpdates } from './bootstrap';

/** Runs the release-only OTA bootstrap once, even if this hook is mounted again. */
export function useExpoUpdatesBootstrap(): void {
  useEffect(() => {
    void bootstrapExpoUpdates();
  }, []);
}
