// Substrings of the OS-level errors iOS/Android surface when an in-flight
// fetch is cut off by the app being backgrounded (the OS suspends the
// socket, then reports the connection as lost or never-connected once the
// app returns to the foreground) -- not a code defect, and not actionable:
// the app already shows the user a retry-able apology message for it (see
// useAssistantChat's onError). Left deliberately narrow -- a real timeout
// ("timed out") is NOT included here, since that can also indicate a
// genuinely slow backend worth knowing about, unlike these two, which are
// unambiguously about the OS tearing down the connection.
//
// Kept in its own file, separate from crash-reporting.ts, so it can be unit
// tested without pulling in @sentry/react-native (which transitively
// imports react-native's own entry point -- Flow syntax bun's test runner
// can't parse outside the app's Metro/Babel pipeline).
const BENIGN_NETWORK_INTERRUPTION_PATTERNS: readonly string[] = [
  'network connection was lost',
  'the internet connection appears to be offline',
];

export function isBenignNetworkInterruption(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return BENIGN_NETWORK_INTERRUPTION_PATTERNS.some((pattern) =>
    lower.includes(pattern),
  );
}
