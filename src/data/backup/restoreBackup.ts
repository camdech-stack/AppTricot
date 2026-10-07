import { db } from '../db'
import { getSettings } from '../settingsRepository'
import { requestPersistentStorage, isStoragePersisted } from '../storage'
import { BackupError } from './backupError'
import {
  BACKUP_TABLES,
  BLOB_FILE_FIELD,
  BLOB_TYPE_FIELD,
  isBlobTable,
  type BackupRow,
  type BackupTableName,
} from './format'
import type { OpenedBackup } from './readBackup'
import { pickExcludedSettings } from './secrets'

export type RestoreMode = 'replace' | 'merge'

export interface RestoreReport {
  mode: RestoreMode
  added: Partial<Record<BackupTableName, number>>
  ignored: Partial<Record<BackupTableName, number>>
  warnings: string[]
  // Ravelry search was enabled in the backup but credentials are never
  // exported: they must be typed again.
  ravelryCredentialsNeeded: boolean
  persistentStorage: boolean
}

export type RestoreProgress = (info: { done: number; total: number }) => void

// Everything the user would lose with "Remplacer tout".
export async function countCurrentData(): Promise<{ total: number; projects: number; patterns: number; yarns: number; guides: number }> {
  const counts = await Promise.all(
    BACKUP_TABLES.filter((name) => name !== 'settings').map((name) => db.table(name).count()),
  )
  const [projects, patterns, yarns, guides] = await Promise.all([
    db.projects.count(),
    db.patterns.count(),
    db.yarns.count(),
    db.guides.count(),
  ])
  return { total: counts.reduce((a, b) => a + b, 0), projects, patterns, yarns, guides }
}

async function attachBlob(opened: OpenedBackup, row: BackupRow): Promise<Record<string, unknown>> {
  const { [BLOB_FILE_FIELD]: path, [BLOB_TYPE_FIELD]: type, ...rest } = row
  const bytes = await opened.zip.file(path as string)!.async('arraybuffer')
  return { ...rest, blob: new Blob([bytes], { type: typeof type === 'string' ? type : '' }) }
}

async function materialize(opened: OpenedBackup, table: BackupTableName, rows: BackupRow[]): Promise<Record<string, unknown>[]> {
  if (!isBlobTable(table)) return rows
  const result: Record<string, unknown>[] = []
  for (const row of rows) result.push(await attachBlob(opened, row))
  return result
}

function describeStorageError(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return "Il n'y a pas assez de place de stockage sur cet appareil."
  }
  return error instanceof Error && error.message ? error.message : 'Erreur inconnue.'
}

async function finish(report: Omit<RestoreReport, 'persistentStorage' | 'ravelryCredentialsNeeded'>): Promise<RestoreReport> {
  const settings = await getSettings()
  let persistentStorage = false
  try {
    persistentStorage = (await isStoragePersisted()) || (await requestPersistentStorage())
  } catch {
    persistentStorage = false
  }
  return {
    ...report,
    persistentStorage,
    ravelryCredentialsNeeded: settings.ravelryEnabled && (!settings.ravelryUsername || !settings.ravelryPassword),
  }
}

// "Remplacer tout": every file is read into memory FIRST, then the database
// is emptied and refilled in ONE transaction. If anything fails (including
// QuotaExceededError) IndexedDB aborts the transaction and the current data
// is left exactly as it was. Ravelry credentials of this device are kept:
// they are never part of a backup, so wiping them would only lose them.
export async function restoreReplaceAll(opened: OpenedBackup, onProgress?: RestoreProgress): Promise<RestoreReport> {
  const total = BACKUP_TABLES.reduce((sum, name) => sum + opened.tables[name].length, 0)
  let done = 0
  const prepared = {} as Record<BackupTableName, Record<string, unknown>[]>
  try {
    for (const name of BACKUP_TABLES) {
      prepared[name] = await materialize(opened, name, opened.tables[name])
      done += opened.tables[name].length
      onProgress?.({ done, total })
    }
  } catch (error) {
    throw new BackupError('restore_failed', `Lecture de la sauvegarde impossible. Rien n'a été modifié. ${describeStorageError(error)}`)
  }

  const current = (await db.settings.toCollection().first()) as Record<string, unknown> | undefined
  const imported = prepared.settings[0] ?? current
  if (imported) {
    prepared.settings = [
      {
        ...imported,
        ...pickExcludedSettings(current ?? {}),
        lastBackupAt: opened.manifest.exportedAt,
        backupReminderSnoozedAt: null,
      },
    ]
  }

  try {
    await db.transaction('rw', db.tables, async () => {
      for (const name of BACKUP_TABLES) {
        await db.table(name).clear()
        if (prepared[name].length > 0) await db.table(name).bulkAdd(prepared[name])
      }
    })
  } catch (error) {
    throw new BackupError(
      'restore_failed',
      `La restauration a échoué. Rien n'a été modifié : tes données actuelles sont intactes. ${describeStorageError(error)}`,
    )
  }

  const added: RestoreReport['added'] = {}
  for (const name of BACKUP_TABLES) added[name] = opened.tables[name].length
  return finish({ mode: 'replace', added, ignored: {}, warnings: [] })
}

interface MergeRule {
  // A child whose parent already exists locally is ignored with it (the
  // parent is never overwritten, so its 1:1 / owned rows stay coherent).
  followsParent?: { field: string; table: BackupTableName }
  // Rows must point at something that exists (locally or just added) when
  // the field is non-null; otherwise they are skipped as dangling.
  requires?: { field: string; table: BackupTableName }[]
  // At most one row per pair: a different id with the same pair is ignored.
  uniquePair?: [string, string]
}

const MERGE_RULES: Partial<Record<BackupTableName, MergeRule>> = {
  yarnImages: { followsParent: { field: 'yarnId', table: 'yarns' } },
  patternFiles: { followsParent: { field: 'patternId', table: 'patterns' } },
  patternCovers: { followsParent: { field: 'patternId', table: 'patterns' } },
  guideContents: { followsParent: { field: 'guideId', table: 'guides' } },
  coverImages: { followsParent: { field: 'projectId', table: 'projects' } },
  counters: { followsParent: { field: 'projectId', table: 'projects' } },
  counterEvents: { followsParent: { field: 'counterId', table: 'counters' } },
  sessions: { requires: [{ field: 'projectId', table: 'projects' }] },
  yarnUsages: {
    requires: [
      { field: 'yarnId', table: 'yarns' },
      { field: 'projectId', table: 'projects' },
    ],
  },
  projectYarns: {
    uniquePair: ['projectId', 'yarnId'],
    requires: [
      { field: 'projectId', table: 'projects' },
      { field: 'yarnId', table: 'yarns' },
    ],
  },
  projectPatterns: {
    uniquePair: ['projectId', 'patternId'],
    requires: [
      { field: 'projectId', table: 'projects' },
      { field: 'patternId', table: 'patterns' },
    ],
  },
  projectGuides: {
    uniquePair: ['projectId', 'guideId'],
    requires: [
      { field: 'projectId', table: 'projects' },
      { field: 'guideId', table: 'guides' },
    ],
  },
  guideProgress: {
    uniquePair: ['projectId', 'guideId'],
    requires: [
      { field: 'projectId', table: 'projects' },
      { field: 'guideId', table: 'guides' },
    ],
  },
  patternViewStates: {
    uniquePair: ['patternId', 'projectId'],
    requires: [
      { field: 'patternId', table: 'patterns' },
      { field: 'projectId', table: 'projects' },
    ],
  },
}

// Parents first; each family is one Dexie transaction.
const MERGE_FAMILIES: BackupTableName[][] = [
  ['yarns', 'yarnImages'],
  ['patterns', 'patternFiles', 'patternCovers'],
  ['guides', 'guideContents'],
  ['projects', 'counters', 'counterEvents', 'coverImages', 'sessions'],
  ['projectYarns', 'yarnUsages', 'projectPatterns', 'patternViewStates', 'projectGuides', 'guideProgress'],
]

function pairKey(row: Record<string, unknown>, [a, b]: [string, string]): string {
  return `${String(row[a])}|${String(row[b])}`
}

async function existingIds(table: BackupTableName, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let start = 0; start < ids.length; start += 500) {
    const keys = await db.table(table).where('id').anyOf(ids.slice(start, start + 500)).primaryKeys()
    for (const key of keys) found.add(key as string)
  }
  return found
}

// "Fusionner": adds what is missing, NEVER overwrites. Rules:
//  - a row whose id already exists locally is kept as is and counted as ignored;
//  - owned rows (counters, events, cover/file blobs, guide content) follow their
//    parent: ignored when the parent already exists locally;
//  - one-per-pair links (yarn/pattern/guide links, guide progress, view states)
//    are ignored when the pair already exists under another id;
//  - rows pointing at a parent found nowhere are skipped (warning);
//  - settings are never touched.
// Each family of tables is one transaction, so a failure leaves earlier
// families imported and the failing one untouched; the error says which.
export async function restoreMerge(opened: OpenedBackup, onProgress?: RestoreProgress): Promise<RestoreReport> {
  const added: RestoreReport['added'] = {}
  const ignored: RestoreReport['ignored'] = {}
  const warnings: string[] = []
  const ignoredIds = new Map<BackupTableName, Set<string>>()
  const addedIds = new Map<BackupTableName, Set<string>>()
  const localIds = new Map<BackupTableName, Set<string>>()
  const total = MERGE_FAMILIES.flat().reduce((sum, name) => sum + opened.tables[name].length, 0)
  let done = 0
  const completed: string[] = []

  async function isKnown(table: BackupTableName, id: string): Promise<boolean> {
    if (addedIds.get(table)?.has(id)) return true
    let local = localIds.get(table)
    if (!local) {
      local = new Set()
      localIds.set(table, local)
    }
    if (!local.has(id)) {
      const hit = await existingIds(table, [id])
      if (!hit.has(id)) return false
      local.add(id)
    }
    return true
  }

  for (const family of MERGE_FAMILIES) {
    const toWrite = {} as Record<BackupTableName, BackupRow[]>
    try {
      for (const table of family) {
        const rows = opened.tables[table]
        const rule = MERGE_RULES[table]
        const present = await existingIds(table, rows.map((row) => row.id))
        localIds.set(table, new Set([...(localIds.get(table) ?? []), ...present]))
        const ignoredSet = new Set<string>()
        const addedSet = new Set<string>()
        const pairs = new Set<string>()
        if (rule?.uniquePair) {
          for (const row of (await db.table(table).toArray()) as Record<string, unknown>[]) pairs.add(pairKey(row, rule.uniquePair))
        }
        const keep: BackupRow[] = []
        let skippedDangling = 0

        for (const row of rows) {
          done += 1
          if (present.has(row.id)) {
            ignoredSet.add(row.id)
            continue
          }
          if (rule?.followsParent) {
            const parentId = row[rule.followsParent.field]
            if (typeof parentId === 'string' && ignoredIds.get(rule.followsParent.table)?.has(parentId)) {
              ignoredSet.add(row.id)
              continue
            }
          }
          if (rule?.requires) {
            let dangling = false
            for (const requirement of rule.requires) {
              const target = row[requirement.field]
              if (typeof target === 'string' && !(await isKnown(requirement.table, target))) dangling = true
            }
            if (dangling) {
              skippedDangling += 1
              continue
            }
          }
          if (rule?.uniquePair) {
            const key = pairKey(row, rule.uniquePair)
            if (pairs.has(key)) {
              ignoredSet.add(row.id)
              continue
            }
            pairs.add(key)
          }
          addedSet.add(row.id)
          keep.push(row)
        }
        if (skippedDangling > 0) {
          warnings.push(`${skippedDangling} élément(s) de « ${table} » ignoré(s) : l'élément auquel ils se rattachent est introuvable.`)
        }
        ignoredIds.set(table, ignoredSet)
        addedIds.set(table, addedSet)
        toWrite[table] = keep
        onProgress?.({ done, total })
      }

      const materialized = {} as Record<BackupTableName, Record<string, unknown>[]>
      for (const table of family) materialized[table] = await materialize(opened, table, toWrite[table])

      await db.transaction('rw', family.map((table) => db.table(table)), async () => {
        for (const table of family) {
          if (materialized[table].length > 0) await db.table(table).bulkAdd(materialized[table])
        }
      })
    } catch (error) {
      for (const table of family) {
        addedIds.delete(table)
      }
      const imported = completed.length > 0 ? `Déjà importé : ${completed.join(', ')}. ` : "Rien n'a encore été importé. "
      throw new BackupError(
        'restore_failed',
        `La fusion s'est arrêtée sur « ${family.join(', ')} » (ce groupe n'a pas été modifié). ${imported}${describeStorageError(error)}`,
      )
    }

    for (const table of family) {
      added[table] = addedIds.get(table)?.size ?? 0
      ignored[table] = ignoredIds.get(table)?.size ?? 0
    }
    completed.push(family.join(', '))
  }

  return finish({ mode: 'merge', added, ignored, warnings })
}

export async function restoreBackup(opened: OpenedBackup, mode: RestoreMode, onProgress?: RestoreProgress): Promise<RestoreReport> {
  return mode === 'replace' ? restoreReplaceAll(opened, onProgress) : restoreMerge(opened, onProgress)
}
