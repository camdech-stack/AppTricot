import Dexie, { type EntityTable } from 'dexie'
import type { AppSettingsRecord } from './types'

// Schema migration convention:
// - Never edit a past `.version(n)` call once it has shipped.
// - Add a new `.version(n + 1).stores({...}).upgrade(tx => {...})` block for
//   every schema change, even additive ones, so existing installs migrate
//   cleanly instead of losing data.
// - Dexie stores only indexed fields in the schema string; new non-indexed
//   fields on existing records can be added without a schema change, but
//   still bump the version and backfill them in `.upgrade()`.
class AppDatabase extends Dexie {
  settings!: EntityTable<AppSettingsRecord, 'id'>

  constructor() {
    super('mon-carnet-de-tricot')

    this.version(1).stores({
      settings: 'id',
    })
  }
}

export const db = new AppDatabase()
