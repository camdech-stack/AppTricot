import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { createProject, deleteProject } from './projectsRepository'
import {
  deletePattern,
  findPatternByHash,
  getPattern,
  getPatternCover,
  getPatternFile,
  getPatternProjectLinks,
  getPatternViewState,
  getProjectPatterns,
  importPattern,
  linkPatternToProject,
  replacePatternFile,
  savePatternViewState,
  setPatternCover,
} from './patternsRepository'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function importTestPattern(overrides: Partial<Parameters<typeof importPattern>[0]> = {}) {
  return importPattern({
    name: 'Pull torsades',
    craft: 'knitting',
    fileName: 'pull.pdf',
    fileHash: 'hash-1',
    pageCount: 10,
    sizeBytes: 1000,
    fileBlob: new Blob(['%PDF-fake']),
    coverBlob: new Blob(['cover']),
    ...overrides,
  })
}

async function createTestProject(overrides: Partial<Parameters<typeof createProject>[0]> = {}) {
  return createProject({ name: 'Pull X', craft: 'knitting', description: '', colorKey: 'prune', ...overrides })
}

describe('importPattern', () => {
  it('writes metadata, file and cover together', async () => {
    const pattern = await importTestPattern()
    expect(await getPatternFile(pattern.id)).toBeDefined()
    expect((await getPatternCover(pattern.id))?.kind).toBe('auto')
    expect(pattern.fileVersion).toBe(1)
  })

  it('writes nothing when any part of the transaction fails', async () => {
    const fixedId = 'fixed-pattern-id'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(fixedId as ReturnType<typeof crypto.randomUUID>)
    const now = new Date().toISOString()
    // Pre-seed a conflicting cover row so the transaction's last write
    // (patternCovers.add) collides and the whole import rolls back.
    await db.patternCovers.add({ id: fixedId, patternId: fixedId, blob: new Blob(['x']), kind: 'auto', createdAt: now, updatedAt: now })

    await expect(importTestPattern()).rejects.toThrow()

    expect(await db.patterns.count()).toBe(0)
    expect(await db.patternFiles.count()).toBe(0)

    vi.restoreAllMocks()
  })
})

describe('findPatternByHash', () => {
  it('finds a duplicate by its file hash', async () => {
    const pattern = await importTestPattern({ fileHash: 'abc123' })
    expect((await findPatternByHash('abc123'))?.id).toBe(pattern.id)
    expect(await findPatternByHash('does-not-exist')).toBeUndefined()
  })
})

describe('replacePatternFile', () => {
  it('bumps fileVersion, keeps metadata/tags/links, clamps view states into the new page range', async () => {
    const pattern = await importTestPattern({ tags: ['hiver'], pageCount: 10 })
    const project = await createTestProject()
    await linkPatternToProject(project.id, pattern.id)
    await savePatternViewState(pattern.id, project.id, { page: 9, zoom: 1, offsetX: 0, offsetY: 0 })
    await savePatternViewState(pattern.id, null, { page: 5, zoom: 1, offsetX: 0, offsetY: 0 })

    const updated = await replacePatternFile(pattern.id, {
      fileBlob: new Blob(['%PDF v2']),
      fileName: 'pull-v2.pdf',
      fileHash: 'hash-v2',
      pageCount: 6,
      sizeBytes: 2000,
      autoCoverBlob: new Blob(['cover v2']),
    })

    expect(updated.fileVersion).toBe(2)
    expect(updated.name).toBe('Pull torsades')
    expect(updated.tags).toEqual(['hiver'])
    expect(updated.pageCount).toBe(6)
    expect(await getProjectPatterns(project.id)).toHaveLength(1)
    expect((await getPatternCover(pattern.id))?.kind).toBe('auto')

    expect((await getPatternViewState(pattern.id, project.id))?.page).toBe(6)
    expect((await getPatternViewState(pattern.id, null))?.page).toBe(5)
  })

  it('leaves a custom cover untouched', async () => {
    const pattern = await importTestPattern()
    await setPatternCover(pattern.id, new Blob(['custom cover']), 'custom')

    await replacePatternFile(pattern.id, {
      fileBlob: new Blob(['%PDF v2']),
      fileName: 'pull.pdf',
      fileHash: 'hash-v2',
      pageCount: 10,
      sizeBytes: 2000,
      autoCoverBlob: new Blob(['new auto cover']),
    })

    expect((await getPatternCover(pattern.id))?.kind).toBe('custom')
  })
})

describe('deletePattern', () => {
  it('cascades to the file, cover, project links and view states', async () => {
    const pattern = await importTestPattern()
    const project = await createTestProject()
    await linkPatternToProject(project.id, pattern.id)
    await savePatternViewState(pattern.id, project.id, { page: 1, zoom: 1, offsetX: 0, offsetY: 0 })

    await deletePattern(pattern.id)

    expect(await getPattern(pattern.id)).toBeUndefined()
    expect(await getPatternFile(pattern.id)).toBeUndefined()
    expect(await getPatternCover(pattern.id)).toBeUndefined()
    expect(await getPatternProjectLinks(pattern.id)).toHaveLength(0)
    expect(await getPatternViewState(pattern.id, project.id)).toBeUndefined()
  })
})

describe('deleteProject and patterns', () => {
  it('removes links and view states but keeps the pattern itself', async () => {
    const pattern = await importTestPattern()
    const project = await createTestProject()
    await linkPatternToProject(project.id, pattern.id)
    await savePatternViewState(pattern.id, project.id, { page: 1, zoom: 1, offsetX: 0, offsetY: 0 })

    await deleteProject(project.id)

    expect(await getPattern(pattern.id)).toBeDefined()
    expect(await getPatternProjectLinks(pattern.id)).toHaveLength(0)
    expect(await getPatternViewState(pattern.id, project.id)).toBeUndefined()
  })
})

describe('linkPatternToProject', () => {
  it('keeps a single link per project/pattern pair', async () => {
    const pattern = await importTestPattern()
    const project = await createTestProject()

    await linkPatternToProject(project.id, pattern.id)
    await linkPatternToProject(project.id, pattern.id)

    expect(await getProjectPatterns(project.id)).toHaveLength(1)
  })
})

describe('pattern view states', () => {
  it('keeps a separate state per project, plus one for the library (projectId null)', async () => {
    const pattern = await importTestPattern()
    const projectA = await createTestProject({ name: 'A' })
    const projectB = await createTestProject({ name: 'B', colorKey: 'rose' })

    await savePatternViewState(pattern.id, null, { page: 1, zoom: 1, offsetX: 0, offsetY: 0 })
    await savePatternViewState(pattern.id, projectA.id, { page: 4, zoom: 1.5, offsetX: 0, offsetY: 0 })
    await savePatternViewState(pattern.id, projectB.id, { page: 7, zoom: 2, offsetX: 0, offsetY: 0 })

    expect((await getPatternViewState(pattern.id, null))?.page).toBe(1)
    expect((await getPatternViewState(pattern.id, projectA.id))?.page).toBe(4)
    expect((await getPatternViewState(pattern.id, projectB.id))?.page).toBe(7)
  })

  it('updates the existing row instead of creating a second one', async () => {
    const pattern = await importTestPattern()
    const first = await savePatternViewState(pattern.id, null, { page: 1, zoom: 1, offsetX: 0, offsetY: 0 })
    const second = await savePatternViewState(pattern.id, null, { page: 2, zoom: 1, offsetX: 0, offsetY: 0 })

    expect(second.id).toBe(first.id)
    expect(await db.patternViewStates.where('patternId').equals(pattern.id).count()).toBe(1)
  })
})
