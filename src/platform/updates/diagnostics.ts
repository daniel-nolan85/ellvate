import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

const updateLogWindowMs = 15 * 60 * 1000;

export type ExpoUpdateDiagnostics = Readonly<{
  channel: string | null;
  createdAt: string | null;
  emergencyLaunchReason: string | null;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  isEnabled: boolean;
  platform: string;
  runtimeVersion: string | null;
  updateId: string | null;
}>;

export type ExpoUpdateFailureDiagnostic = Readonly<{
  code: string;
  level: string;
  message: string;
  updateId?: string;
}>;

export function summarizeExpoUpdateError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getExpoUpdateDiagnostics(): ExpoUpdateDiagnostics {
  return {
    channel: Updates.channel,
    createdAt: Updates.createdAt?.toISOString() ?? null,
    emergencyLaunchReason: Updates.emergencyLaunchReason ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    isEnabled: Updates.isEnabled,
    platform: Platform.OS,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
  };
}

export async function getRecentExpoUpdateFailures(): Promise<ExpoUpdateFailureDiagnostic[]> {
  const entries = await Updates.readLogEntriesAsync(updateLogWindowMs);

  return entries
    .filter((entry) => entry.level === 'error' || entry.level === 'fatal')
    .slice(-5)
    .map((entry) => ({
      code: entry.code,
      level: entry.level,
      message: entry.message,
      updateId: entry.updateId,
    }));
}

export async function logExpoUpdateDiagnostics(): Promise<void> {
  console.info('[expo-updates] Startup state', getExpoUpdateDiagnostics());

  const failures = await getRecentExpoUpdateFailures();

  if (failures.length > 0) {
    console.warn('[expo-updates] Recent native update failures', failures);
  }
}
