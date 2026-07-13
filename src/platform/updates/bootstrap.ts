import * as Updates from 'expo-updates';

import {
  getExpoUpdateDiagnostics,
  logExpoUpdateDiagnostics,
  summarizeExpoUpdateError,
  type ExpoUpdateDiagnostics,
} from './diagnostics';

export type ExpoUpdateBootstrapStatus =
  | 'failed'
  | 'no-update'
  | 'reload-requested'
  | 'skipped-development'
  | 'skipped-disabled'
  | 'update-not-fetched';

export type ExpoUpdateBootstrapResult = Readonly<{
  diagnostics: ExpoUpdateDiagnostics;
  error?: string;
  status: ExpoUpdateBootstrapStatus;
}>;

let bootstrapPromise: Promise<ExpoUpdateBootstrapResult> | null = null;

function result(
  status: ExpoUpdateBootstrapStatus,
  diagnostics: ExpoUpdateDiagnostics,
  error?: string,
): ExpoUpdateBootstrapResult {
  return error ? { diagnostics, error, status } : { diagnostics, status };
}

async function runExpoUpdatesBootstrap(): Promise<ExpoUpdateBootstrapResult> {
  const diagnostics = getExpoUpdateDiagnostics();

  try {
    await logExpoUpdateDiagnostics().catch((error: unknown) => {
      console.warn(
        '[expo-updates] Could not read native update logs',
        summarizeExpoUpdateError(error),
      );
    });

    const checkResult = await Updates.checkForUpdateAsync();

    if (!checkResult.isAvailable) {
      return result('no-update', diagnostics);
    }

    console.info('[expo-updates] Update available, fetching');
    const fetchResult = await Updates.fetchUpdateAsync();

    if (!fetchResult.isNew) {
      return result('update-not-fetched', diagnostics);
    }

    console.info('[expo-updates] Update downloaded, reloading');
    await Updates.reloadAsync();

    return result('reload-requested', diagnostics);
  } catch (error: unknown) {
    const message = summarizeExpoUpdateError(error);
    console.warn('[expo-updates] Update bootstrap failed', message);

    return result('failed', diagnostics, message);
  }
}

/**
 * Checks for a compatible OTA update once per JavaScript runtime.
 *
 * Development mode and builds without a valid expo-updates configuration are
 * deliberately skipped. Failures are logged and returned instead of crashing
 * app startup.
 */
export function bootstrapExpoUpdates(): Promise<ExpoUpdateBootstrapResult> {
  const diagnostics = getExpoUpdateDiagnostics();

  if (__DEV__) {
    return Promise.resolve(result('skipped-development', diagnostics));
  }

  if (!Updates.isEnabled) {
    return Promise.resolve(result('skipped-disabled', diagnostics));
  }

  bootstrapPromise ??= runExpoUpdatesBootstrap();

  return bootstrapPromise;
}
