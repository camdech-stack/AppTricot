// Single entry point for all data access. Components must import from here
// (or from a hook built on top of it) and never call Dexie directly.
export { db } from './db'
export { createId } from './id'
export { ensureSettingsInitialized, getSettings, updateSettings, watchSettings } from './settingsRepository'
export { requestPersistentStorage, isStoragePersisted } from './storage'
export type { BaseEntity, AppSettingsRecord, LengthUnit, WeightUnit } from './types'
