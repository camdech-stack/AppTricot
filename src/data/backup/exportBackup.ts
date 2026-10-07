import { db, CURRENT_SCHEMA_VERSION } from '../db'
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BLOB_FILE_FIELD,
  BLOB_TYPE_FIELD,
  DATA_PATH,
  MANIFEST_PATH,
  blobFilePath,
  getBackupFileName,
  isBlobTable,
  type BackupManifest,
  type BackupRow,
  type BackupTableName,
} from './format'
import { stripExcludedSettings } from './secrets'

export interface BuiltBackup {
  blob: Blob
  fileName: string
  manifest: BackupManifest
  // Total number of exported records (all tables) and of binary files.
  itemCount: number
  fileCount: number
}

export interface ExportProgress {
  // 0..100
  percent: number
}

// Rough size of a backup before building it, for the "this may take a
// while" hint: PDFs dominate, images are compressed to ~200 Ko each.
export async function estimateBackupBytes(): Promise<number> {
  const [patterns, covers, yarnImages, coverImages] = await Promise.all([
    db.patterns.toArray(),
    db.patternCovers.count(),
    db.yarnImages.count(),
    db.coverImages.count(),
  ])
  const pdfBytes = patterns.reduce((sum, pattern) => sum + pattern.sizeBytes, 0)
  return pdfBytes + (covers + yarnImages + coverImages) * 200 * 1024
}

export async function hasBackupWorthyData(): Promise<boolean> {
  const [projects, yarns] = await Promise.all([db.projects.count(), db.yarns.count()])
  return projects + yarns > 0
}

function appVersion(): string | null {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null
}

async function snapshotTables(): Promise<Record<BackupTableName, Record<string, unknown>[]>> {
  // One read transaction so the archive is a consistent snapshot even if a
  // counter is tapped while it is being built.
  return db.transaction('r', db.tables, async () => {
    const snapshot = {} as Record<BackupTableName, Record<string, unknown>[]>
    for (const name of BACKUP_TABLES) {
      snapshot[name] = (await db.table(name).toArray()) as Record<string, unknown>[]
    }
    return snapshot
  })
}

export async function buildBackup(
  onProgress?: (progress: ExportProgress) => void,
  now: Date = new Date(),
): Promise<BuiltBackup> {
  const snapshot = await snapshotTables()
  // Loaded on demand: JSZip stays out of the main bundle.
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const data: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  let fileCount = 0

  for (const name of BACKUP_TABLES) {
    const rows: Record<string, unknown>[] = []
    for (const record of snapshot[name]) {
      if (name === 'settings') {
        rows.push(stripExcludedSettings(record))
        continue
      }
      if (isBlobTable(name)) {
        const { blob, ...rest } = record as Record<string, unknown> & { blob: Blob; id: string }
        const path = blobFilePath(name, rest.id, blob.type)
        // Images and PDFs are already compressed: storing them avoids a
        // costly, useless deflate pass over hundreds of megabytes.
        zip.file(path, blob, { compression: 'STORE', binary: true })
        fileCount += 1
        rows.push({ ...rest, [BLOB_FILE_FIELD]: path, [BLOB_TYPE_FIELD]: blob.type })
        continue
      }
      rows.push(record)
    }
    data[name] = rows
    counts[name] = rows.length
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: appVersion(),
    exportedAt: now.toISOString(),
    counts,
  }
  zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2), { compression: 'DEFLATE' })
  zip.file(DATA_PATH, JSON.stringify(data), { compression: 'DEFLATE', compressionOptions: { level: 6 } })

  // Streamed generation: chunks are collected as they are produced instead
  // of materialising the whole archive as one contiguous buffer, and JSZip
  // yields to the event loop between chunks so the UI keeps painting.
  // streamFiles stays off: data descriptors on stored entries confuse some
  // unzip tools, and the archive must open everywhere.
  const parts: Uint8Array<ArrayBuffer>[] = []
  await new Promise<void>((resolve, reject) => {
    zip
      .generateInternalStream({ type: 'uint8array', streamFiles: false, compression: 'STORE' })
      .on('data', (chunk, metadata) => {
        parts.push(chunk as Uint8Array<ArrayBuffer>)
        onProgress?.({ percent: Math.min(100, Math.round(metadata.percent)) })
      })
      .on('error', reject)
      .on('end', () => resolve())
      .resume()
  })

  const blob = new Blob(parts, { type: 'application/zip' })
  onProgress?.({ percent: 100 })
  const itemCount = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return { blob, fileName: getBackupFileName(now), manifest, itemCount, fileCount }
}

export type { BackupRow }
