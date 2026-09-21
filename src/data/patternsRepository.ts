import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import { normalizeTags } from './tagUtils'
import type {
  PatternCoverKind,
  PatternCoverRecord,
  PatternFileRecord,
  PatternRecord,
  PatternViewStateRecord,
  ProjectCraft,
  ProjectPatternRecord,
} from './types'

export interface NewPatternInput {
  name: string
  craft: ProjectCraft | null
  tags?: string[]
  source?: string
  materials?: string
  notes?: string
  fileName: string
  fileHash: string
  pageCount: number
  sizeBytes: number
  fileBlob: Blob
  coverBlob: Blob
}

export async function getPatterns(): Promise<PatternRecord[]> {
  return db.patterns.toArray()
}

export async function getPattern(id: string): Promise<PatternRecord | undefined> {
  return db.patterns.get(id)
}

export async function findPatternByHash(hash: string): Promise<PatternRecord | undefined> {
  return db.patterns.where('fileHash').equals(hash).first()
}

// Writes metadata, file and cover in a single Dexie transaction: if any
// write fails (including QuotaExceededError on the PDF blob), IndexedDB
// rolls back the whole transaction automatically, so nothing partial is
// ever left behind — see CLAUDE.md "L'import est atomique".
export async function importPattern(input: NewPatternInput): Promise<PatternRecord> {
  return db.transaction('rw', db.patterns, db.patternFiles, db.patternCovers, async () => {
    const now = nowIso()
    const id = createId()
    const pattern: PatternRecord = {
      id,
      name: input.name,
      craft: input.craft,
      tags: normalizeTags(input.tags ?? []),
      source: input.source ?? '',
      materials: input.materials ?? '',
      notes: input.notes ?? '',
      pageCount: input.pageCount,
      sizeBytes: input.sizeBytes,
      fileName: input.fileName,
      fileHash: input.fileHash,
      fileVersion: 1,
      fileUpdatedAt: now,
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.patterns.add(pattern)
    await db.patternFiles.add({ id, patternId: id, blob: input.fileBlob, createdAt: now, updatedAt: now })
    await db.patternCovers.add({ id, patternId: id, blob: input.coverBlob, kind: 'auto', createdAt: now, updatedAt: now })
    return pattern
  })
}

export interface PatternMetaUpdateInput {
  name?: string
  craft?: ProjectCraft | null
  tags?: string[]
  source?: string
  materials?: string
  notes?: string
}

export async function updatePatternMeta(id: string, patch: PatternMetaUpdateInput): Promise<PatternRecord> {
  const current = await db.patterns.get(id)
  if (!current) throw new Error(`Patron introuvable : ${id}`)
  const updated: PatternRecord = {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: nowIso(),
  }
  await db.patterns.put(updated)
  return updated
}

export interface ReplacePatternFileInput {
  fileBlob: Blob
  fileName: string
  fileHash: string
  pageCount: number
  sizeBytes: number
  // Only used when the current cover is still "auto" — a custom cover is
  // left untouched (see CLAUDE.md "Remplacer une version").
  autoCoverBlob: Blob
}

// Bumps fileVersion, replaces the file (and the cover, if it's still the
// auto-generated one) and clamps every reading position for this pattern
// into the new page range. Metadata, tags and project links are untouched.
export async function replacePatternFile(id: string, input: ReplacePatternFileInput): Promise<PatternRecord> {
  return db.transaction('rw', db.patterns, db.patternFiles, db.patternCovers, db.patternViewStates, async () => {
    const current = await db.patterns.get(id)
    if (!current) throw new Error(`Patron introuvable : ${id}`)
    const now = nowIso()

    const updated: PatternRecord = {
      ...current,
      fileName: input.fileName,
      fileHash: input.fileHash,
      pageCount: input.pageCount,
      sizeBytes: input.sizeBytes,
      fileVersion: current.fileVersion + 1,
      fileUpdatedAt: now,
      updatedAt: now,
    }
    await db.patterns.put(updated)

    const existingFile = await db.patternFiles.get(id)
    await db.patternFiles.put({
      id,
      patternId: id,
      blob: input.fileBlob,
      createdAt: existingFile?.createdAt ?? now,
      updatedAt: now,
    })

    const existingCover = await db.patternCovers.get(id)
    if (!existingCover || existingCover.kind === 'auto') {
      await db.patternCovers.put({
        id,
        patternId: id,
        blob: input.autoCoverBlob,
        kind: 'auto',
        createdAt: existingCover?.createdAt ?? now,
        updatedAt: now,
      })
    }

    const states = await db.patternViewStates.where('patternId').equals(id).toArray()
    for (const state of states) {
      const clampedPage = Math.min(Math.max(state.page, 1), Math.max(input.pageCount, 1))
      if (clampedPage !== state.page) {
        await db.patternViewStates.update(state.id, { page: clampedPage, updatedAt: now })
      }
    }

    return updated
  })
}

export async function setPatternCover(patternId: string, blob: Blob, kind: PatternCoverKind = 'custom'): Promise<PatternCoverRecord> {
  const now = nowIso()
  const existing = await db.patternCovers.get(patternId)
  const record: PatternCoverRecord = { id: patternId, patternId, blob, kind, createdAt: existing?.createdAt ?? now, updatedAt: now }
  await db.patternCovers.put(record)
  return record
}

export async function getPatternCover(patternId: string): Promise<PatternCoverRecord | undefined> {
  return db.patternCovers.get(patternId)
}

export async function getPatternFile(patternId: string): Promise<PatternFileRecord | undefined> {
  return db.patternFiles.get(patternId)
}

export async function touchPatternOpened(id: string): Promise<void> {
  await db.patterns.update(id, { lastOpenedAt: nowIso() })
}

// Deletes the file, cover, every project link and every reading position —
// see CLAUDE.md "Supprimer un patron". Guides that referenced this pattern
// are kept (their patternId just goes back to null), never deleted — a
// guide is a reusable model independent of any one pattern file.
export async function deletePattern(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.patterns, db.patternFiles, db.patternCovers, db.projectPatterns, db.patternViewStates, db.guides],
    async () => {
      await db.patternFiles.delete(id)
      await db.patternCovers.delete(id)
      await db.projectPatterns.where('patternId').equals(id).delete()
      await db.patternViewStates.where('patternId').equals(id).delete()
      await db.guides.where('patternId').equals(id).modify({ patternId: null, updatedAt: nowIso() })
      await db.patterns.delete(id)
    },
  )
}

export async function getProjectPatterns(projectId: string): Promise<ProjectPatternRecord[]> {
  const links = await db.projectPatterns.where('projectId').equals(projectId).toArray()
  return links.sort((a, b) => a.position - b.position)
}

export async function getPatternProjectLinks(patternId: string): Promise<ProjectPatternRecord[]> {
  return db.projectPatterns.where('patternId').equals(patternId).toArray()
}

export async function getAllProjectPatterns(): Promise<ProjectPatternRecord[]> {
  return db.projectPatterns.toArray()
}

// One link per (project, pattern) pair: links the existing one instead of
// creating a duplicate when the pair is already present — same convention
// as linkYarnToProject.
export async function linkPatternToProject(projectId: string, patternId: string): Promise<ProjectPatternRecord> {
  return db.transaction('rw', db.projectPatterns, async () => {
    const existing = await db.projectPatterns.where('[projectId+patternId]').equals([projectId, patternId]).first()
    if (existing) return existing
    const siblings = await getProjectPatterns(projectId)
    const position = siblings.reduce((max, link) => Math.max(max, link.position), -1) + 1
    const now = nowIso()
    const link: ProjectPatternRecord = { id: createId(), projectId, patternId, position, createdAt: now, updatedAt: now }
    await db.projectPatterns.add(link)
    return link
  })
}

export async function unlinkPatternFromProject(linkId: string): Promise<void> {
  await db.projectPatterns.delete(linkId)
}

// projectId null means "opened straight from the library". Looked up by the
// patternId index alone and filtered in JS — a compound index would silently
// exclude the null-projectId rows, same IndexedDB limitation as standalone
// counters/sessions (see CLAUDE.md).
export async function getPatternViewState(patternId: string, projectId: string | null): Promise<PatternViewStateRecord | undefined> {
  const states = await db.patternViewStates.where('patternId').equals(patternId).toArray()
  return states.find((state) => state.projectId === projectId)
}

export interface PatternViewStateInput {
  page: number
  zoom: number
  offsetX: number
  offsetY: number
}

// At most one row per (patternId, projectId) pair: updates the existing one
// in place instead of creating a second.
export async function savePatternViewState(
  patternId: string,
  projectId: string | null,
  input: PatternViewStateInput,
): Promise<PatternViewStateRecord> {
  return db.transaction('rw', db.patternViewStates, async () => {
    const existing = await getPatternViewState(patternId, projectId)
    const now = nowIso()
    const record: PatternViewStateRecord = {
      id: existing?.id ?? createId(),
      patternId,
      projectId,
      page: input.page,
      zoom: input.zoom,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.patternViewStates.put(record)
    return record
  })
}

// The most recently viewed pattern within a project, derived from reading
// positions rather than a separate field — see CLAUDE.md "Vue de travail".
export async function getLastUsedPatternIdForProject(projectId: string): Promise<string | undefined> {
  const states = await db.patternViewStates.where('projectId').equals(projectId).toArray()
  states.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return states[0]?.patternId
}
