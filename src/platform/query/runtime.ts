let isRuntimeConfigured = false

/**
 * Non-Metro test/web fallback. Native bundles resolve `runtime.native.ts`,
 * while TanStack's browser managers remain intact on web.
 */
export function configureQueryRuntime(): void {
  if (isRuntimeConfigured) {
    return
  }

  isRuntimeConfigured = true
}
