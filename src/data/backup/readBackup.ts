import type JSZip from 'jszip'
import { CURRENT_SCHEMA_VERSION } from '../db'
import { migrateGuideContent } from '../guideTree'
import type { GuideContent } from '../guideModel'
import { BackupError } from './backupError'
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BLOB_FILE_FIELD,
  DATA_PATH,
  MANIFEST_PATH,
  isBlobTable,
  type BackupManifest,
  type BackupRow,
  type BackupTables,
} from './format'
import { emptyTables, migrateTablesToCurrent } from './migrateBackup'
import { stripExcludedSettings } from './secrets'

export interface BackupSummary {
  projects: number
  patterns: number
  yarns: number
  guides: number
  exportedAt: string
}

export interface OpenedBackup {
  zip: JSZip
  manifest: BackupManifest
  // Rows at the CURRENT schema, secrets stripped, blobs not attached yet.
  tables: BackupTables
  summary: BackupSummary
  // True when the file was written by an older schema and has been migrated.
  migrated: boolean
}

const NOT_A_BACKUP = "Ce fichier n'est pas une sauvegarde valide : l'archive est illisible ou corrompue."

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(zip: JSZip, path: string): Promise<unknown> {
  const entry = zip.file(path)
  if (!entry) return undefined
  try {
    return JSON.parse(await entry.async('string'))
  } catch {
    return null
  }
}

function parseManifest(value: unknown): BackupManifest {
  if (
    !isRecord(value) ||
    value.format !== BACKUP_FORMAT ||
    typeof value.schemaVersion !== 'number' ||
    !Number.isInteger(value.schemaVersion) ||
    value.schemaVersion < 1 ||
    typeof value.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(value.exportedAt)) ||
    !isRecord(value.counts)
  ) {
    throw new BackupError('invalid_manifest', "Ce fichier n'est pas une sauvegarde de cette application (manifeste invalide).")
  }
  return value as unknown as BackupManifest
}

// Validates the whole archive BEFORE anything is written to the database.
export async function openBackup(file: Blob): Promise<OpenedBackup> {
  let zip: JSZip
  try {
    const { default: JSZipClass } = await import('jszip')
    zip = await JSZipClass.loadAsync(file)
  } catch {
    throw new BackupError('not_a_backup', NOT_A_BACKUP)
  }

  const manifestJson = await readJson(zip, MANIFEST_PATH)
  if (manifestJson === undefined) {
    throw new BackupError('invalid_manifest', "Ce fichier n'est pas une sauvegarde de cette application (manifest.json introuvable).")
  }
  const manifest = parseManifest(manifestJson)

  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new BackupError(
      'newer_version',
      "Cette sauvegarde vient d'une version plus récente de l'app, mets-la à jour avant d'importer.",
    )
  }

  const dataJson = await readJson(zip, DATA_PATH)
  if (!isRecord(dataJson)) {
    throw new BackupError('invalid_data', 'La sauvegarde est incomplète ou corrompue (data.json absent ou illisible).')
  }

  const raw = emptyTables()
  for (const name of BACKUP_TABLES) {
    const rows = dataJson[name]
    if (rows === undefined) continue
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row) || typeof row.id !== 'string' || row.id === '')) {
      throw new BackupError('invalid_data', `La sauvegarde est corrompue (table « ${name} » invalide).`)
    }
    const ids = new Set(rows.map((row) => (row as BackupRow).id))
    if (ids.size !== rows.length) {
      throw new BackupError('invalid_data', `La sauvegarde est corrompue (identifiants en double dans « ${name} »).`)
    }
    raw[name] = rows as BackupRow[]
  }

  for (const [name, count] of Object.entries(manifest.counts)) {
    const table = raw[name as keyof BackupTables]
    if (table && table.length !== count) {
      throw new BackupError(
        'incomplete',
        `La sauvegarde est incomplète ou tronquée (« ${name} » : ${table.length} enregistrement(s) au lieu de ${String(count)}).`,
      )
    }
  }

  for (const name of BACKUP_TABLES) {
    if (!isBlobTable(name)) continue
    for (const row of raw[name]) {
      const path = row[BLOB_FILE_FIELD]
      if (typeof path !== 'string' || !zip.file(path)) {
        throw new BackupError('incomplete', `La sauvegarde est incomplète : un fichier est manquant (${name}/${row.id}).`)
      }
    }
  }

  const migratedRows = await migrateTablesToCurrent(raw, manifest.schemaVersion)
  const tables = sanitize(migratedRows)

  return {
    zip,
    manifest,
    tables,
    migrated: manifest.schemaVersion < CURRENT_SCHEMA_VERSION,
    summary: {
      projects: tables.projects.length,
      patterns: tables.patterns.length,
      yarns: tables.yarns.length,
      guides: tables.guides.length,
      exportedAt: manifest.exportedAt,
    },
  }
}

// Defensive pass: secrets are dropped even if a hand-edited archive carries
// them, and guide trees go through their own migration function.
function sanitize(tables: BackupTables): BackupTables {
  return {
    ...tables,
    settings: tables.settings.map((row) => stripExcludedSettings(row) as BackupRow),
    guideContents: tables.guideContents.map((row) => ({
      ...row,
      content: migrateGuideContent(row.content as GuideContent),
    })),
  }
}
