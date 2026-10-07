import Dexie from 'dexie'
import { CURRENT_SCHEMA_VERSION, declareSchema } from '../db'
import { createId } from '../id'
import { BACKUP_TABLES, type BackupRow, type BackupTableName, type BackupTables } from './format'

export function emptyTables(): BackupTables {
  const tables = {} as BackupTables
  for (const name of BACKUP_TABLES) tables[name] = []
  return tables
}

// Brings backup rows written under an older schema up to the current one by
// running the app's own `.upgrade()` functions (declareSchema in db.ts):
// rows go into a throwaway database opened at the backup's version, which
// is then reopened at the current version so Dexie migrates it exactly as it
// would a real install. No migration logic is duplicated here. Blobs never
// take part (no upgrade touches them), so rows are migrated without them.
export async function migrateTablesToCurrent(tables: BackupTables, fromVersion: number): Promise<BackupTables> {
  if (fromVersion >= CURRENT_SCHEMA_VERSION) return tables

  const name = `backup-migration-${createId()}`
  try {
    const legacy = new Dexie(name)
    declareSchema(legacy, fromVersion)
    await legacy.open()
    const knownTables = new Set(legacy.tables.map((table) => table.name))
    try {
      for (const tableName of BACKUP_TABLES) {
        // A table introduced after the backup's version cannot be in it.
        if (!knownTables.has(tableName) || tables[tableName].length === 0) continue
        await legacy.table(tableName).bulkAdd(tables[tableName])
      }
    } finally {
      legacy.close()
    }

    const upgraded = new Dexie(name)
    declareSchema(upgraded)
    await upgraded.open()
    try {
      const result = emptyTables()
      for (const tableName of BACKUP_TABLES) {
        result[tableName] = (await upgraded.table(tableName).toArray()) as BackupRow[]
      }
      return result
    } finally {
      upgraded.close()
    }
  } finally {
    await Dexie.delete(name)
  }
}

export type { BackupTableName }
