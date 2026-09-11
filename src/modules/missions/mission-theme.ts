import type { AppIconName } from '@/src/components/ui/icon';

import type { MissionTheme } from './use-missions';

export const MISSION_THEMES: readonly MissionTheme[] = [
  'trail',
  'water',
  'village',
  'day',
  'night',
  'social',
];

export const MISSION_THEME_LABEL: Readonly<Record<MissionTheme, string>> = {
  day: 'Day',
  night: 'Night',
  social: 'Social',
  trail: 'Trail',
  village: 'Village',
  water: 'Water',
};

const MISSION_THEME_ICON: Readonly<Record<MissionTheme, AppIconName>> = {
  day: 'Sun',
  night: 'Moon',
  social: 'Users',
  trail: 'Footprints',
  village: 'Store',
  water: 'Waves',
};

// Theme is optional -- purely decorative, picking which icon shows on a
// mission's card/detail badge. A generic flag stands in for one left unset.
const DEFAULT_MISSION_ICON: AppIconName = 'Flag';

export function missionThemeIcon(theme: MissionTheme | null): AppIconName {
  return theme ? MISSION_THEME_ICON[theme] : DEFAULT_MISSION_ICON;
}
