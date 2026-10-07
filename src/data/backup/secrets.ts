import type { AppSettingsRecord } from '../types'

// Settings fields that must NEVER be written to a backup, in any form.
// Any future secret (API key, token, password...) added to AppSettingsRecord
// MUST be listed here — backup.test.ts fails if a field with a sensitive-
// looking name is missing from this list.
const EXCLUDED_SETTINGS_KEYS = ['ravelryUsername', 'ravelryPassword'] as const satisfies readonly (keyof AppSettingsRecord)[]

export function getBackupExcludedSettingsKeys(): readonly string[] {
  return EXCLUDED_SETTINGS_KEYS
}

export function stripExcludedSettings<T extends Record<string, unknown>>(settings: T): Omit<T, 'ravelryUsername' | 'ravelryPassword'> {
  const copy: Record<string, unknown> = { ...settings }
  for (const key of getBackupExcludedSettingsKeys()) delete copy[key]
  return copy as Omit<T, 'ravelryUsername' | 'ravelryPassword'>
}

export function pickExcludedSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of getBackupExcludedSettingsKeys()) {
    if (key in settings) picked[key] = settings[key]
  }
  return picked
}
