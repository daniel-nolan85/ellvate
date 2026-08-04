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

export function missionThemeIcon(theme: MissionTheme): AppIconName {
  return MISSION_THEME_ICON[theme];
}
