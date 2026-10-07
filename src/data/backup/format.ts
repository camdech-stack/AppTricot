import { APP_NAME } from '../../config/appInfo'

// Order matters for readability of data.json only; restore order is handled
// by restoreBackup.ts.
export const BACKUP_TABLES = [
  'settings',
  'projects',
  'counters',
  'counterEvents',
  'coverImages',
  'sessions',
  'yarns',
  'yarnImages',
  'projectYarns',
  'yarnUsages',
  'patterns',
  'patternFiles',
  'patternCovers',
  'projectPatterns',
  'patternViewStates',
  'guides',
  'guideContents',
  'projectGuides',
  'guideProgress',
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]

// Tables whose rows carry a Blob. In data.json those rows keep every field
// except `blob`, and gain `blobFile` (path inside the zip) and `blobType`
// (MIME type, restored onto the Blob on import).
export const BLOB_TABLES = ['coverImages', 'yarnImages', 'patternFiles', 'patternCovers'] as const
export type BlobTableName = (typeof BLOB_TABLES)[number]

export function isBlobTable(table: string): table is BlobTableName {
  return (BLOB_TABLES as readonly string[]).includes(table)
}

export const BACKUP_FORMAT = 1
export const MANIFEST_PATH = 'manifest.json'
export const DATA_PATH = 'data.json'

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  appVersion: string | null
  exportedAt: string
  counts: Record<string, number>
}

export type BackupRow = Record<string, unknown> & { id: string }
export type BackupTables = Record<BackupTableName, BackupRow[]>

export const BLOB_FILE_FIELD = 'blobFile'
export const BLOB_TYPE_FIELD = 'blobType'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

export function blobExtension(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? 'bin'
}

export function blobFilePath(table: BlobTableName, id: string, mime: string): string {
  return `files/${table}/${id}.${blobExtension(mime)}`
}

// "Tricot" -> "tricot": the prefix follows APP_NAME so a rename needs no
// change here.
export const BACKUP_FILE_PREFIX = `${APP_NAME.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-sauvegarde`

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// tricot-sauvegarde-2026-10-07-14h05.zip (local time)
export function getBackupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${BACKUP_FILE_PREFIX}-${day}-${pad(date.getHours())}h${pad(date.getMinutes())}.zip`
}
