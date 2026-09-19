import { db } from './db'
import { nowIso } from './date'
import type { CoverImageRecord } from './types'

// The caller compresses the photo (see src/data/image.ts) before calling
// this: compressing at selection time, right when the file is picked,
// means the raw full-resolution original is never held onto or rendered —
// only its already-downscaled result reaches this repository and any
// preview <img>.
//
// The cover is 1:1 with its project, so the project's own id doubles as the
// cover's primary key — no separate uuid or projectId index needed to look
// one up.
export async function setCoverImage(projectId: string, blob: Blob): Promise<CoverImageRecord> {
  const now = nowIso()
  const existing = await db.coverImages.get(projectId)
  const record: CoverImageRecord = {
    id: projectId,
    projectId,
    blob,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.coverImages.put(record)
  return record
}

export async function getCoverImage(projectId: string): Promise<CoverImageRecord | undefined> {
  return db.coverImages.get(projectId)
}

export async function deleteCoverImage(projectId: string): Promise<void> {
  await db.coverImages.delete(projectId)
}
