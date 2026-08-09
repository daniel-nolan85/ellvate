// Pure so it's unit-testable via `bun:test` without pulling in React Native
// through use-missions.ts's query/session/haptics imports. previousLevel is
// undefined when there was no cached view yet (e.g. first load), in which
// case there's nothing to compare against and no level-up is reported.
export function computeLeveledUpTo(
  previousLevel: number | undefined,
  newLevel: number,
): number | null {
  return previousLevel !== undefined && newLevel > previousLevel ? newLevel : null;
}
