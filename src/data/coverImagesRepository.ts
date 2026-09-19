import { db } from './db'
import { nowIso } from './date'
import { compressCoverImage } from './image'
import type { CoverImageRecord } from './types'

// The cover is 1:1 with its project, so the project's own id doubles as the
// cover's primary key — no separate uuid or projectId index needed to look
// one up.
export async function setCoverImage(projectId: string, file: File): Promise<CoverImageRecord> {
  const blob = await compressCoverImage(file)
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
