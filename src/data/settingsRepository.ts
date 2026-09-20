import { liveQuery } from 'dexie'
import { db } from './db'
import type { AppSettingsRecord, LengthUnit } from './types'

const SETTINGS_ID = 'app-settings'

function defaultSettings(now: string): AppSettingsRecord {
  return {
    id: SETTINGS_ID,
    lengthUnit: 'm',
    weightUnit: 'g',
    trackingEnabled: true,
    createdAt: now,
    updatedAt: now,
  }
}

// Call once at app startup, before any liveQuery subscribes: a liveQuery's
// tracked function must be read-only, so creating the default row can't
// happen inside `watchSettings` itself (Dexie's change tracking breaks if
// the observed query also writes to the table it watches).
export async function ensureSettingsInitialized(): Promise<void> {
  const existing = await db.settings.get(SETTINGS_ID)
  if (!existing) {
    await db.settings.put(defaultSettings(new Date().toISOString()))
  }
}

export async function getSettings(): Promise<AppSettingsRecord> {
  const existing = await db.settings.get(SETTINGS_ID)
  if (existing) return existing
  await ensureSettingsInitialized()
  return (await db.settings.get(SETTINGS_ID))!
}

export async function updateSettings(
  patch: Partial<Pick<AppSettingsRecord, 'lengthUnit' | 'trackingEnabled'>>,
): Promise<AppSettingsRecord> {
  const current = await getSettings()
  const updated: AppSettingsRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await db.settings.put(updated)
  return updated
}

export function watchSettings() {
  return liveQuery(() => db.settings.get(SETTINGS_ID))
}

export type { AppSettingsRecord, LengthUnit }
