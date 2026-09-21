import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject, deleteProject } from './projectsRepository'
import { deletePattern, importPattern } from './patternsRepository'
import {
  createGuide,
  deleteGuide,
  duplicateGuide,
  getGuide,
  getGuideContent,
  getGuideProjectLinks,
  getProjectGuides,
  linkGuideToProject,
  saveGuideContent,
  updateGuideMeta,
} from './guidesRepository'
import { addPiece } from './guideTree'
import type { GuideContent } from './guideModel'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function createTestProject(overrides: Partial<Parameters<typeof createProject>[0]> = {}) {
  return createProject({ name: 'Pull X', craft: 'knitting', description: '', colorKey: 'prune', ...overrides })
}

async function importTestPattern() {
  return importPattern({
    name: 'Pull torsades',
    craft: 'knitting',
    fileName: 'pull.pdf',
    fileHash: 'hash-1',
    pageCount: 10,
    sizeBytes: 1000,
    fileBlob: new Blob(['%PDF-fake']),
    coverBlob: new Blob(['cover']),
  })
}

describe('createGuide', () => {
  it('creates the guide and an empty content in one go', async () => {
    const guide = await createGuide({ name: 'Pull sans manches' })
    expect(guide.name).toBe('Pull sans manches')
    expect(guide.craft).toBeNull()
    expect(guide.patternId).toBeNull()
    const content = await getGuideContent(guide.id)
    expect(content).toEqual({ schemaVersion: 1, pieces: [] })
  })
})

describe('updateGuideMeta', () => {
  it('renames a guide and links a pattern', async () => {
    const guide = await createGuide({ name: 'Brouillon' })
    const pattern = await importTestPattern()
    const updated = await updateGuideMeta(guide.id, { name: 'Pull torsades', patternId: pattern.id })
    expect(updated.name).toBe('Pull torsades')
    expect(updated.patternId).toBe(pattern.id)
  })
})

describe('saveGuideContent', () => {
  it('persists the full content and updates lastEditedNodeId', async () => {
    const guide = await createGuide({ name: 'Pull' })
    const { content, id: pieceId } = addPiece((await getGuideContent(guide.id)) as GuideContent, 'Dos')
    await saveGuideContent(guide.id, content, pieceId)

    const reloaded = await getGuide(guide.id)
    const reloadedContent = await getGuideContent(guide.id)
    expect(reloaded?.lastEditedNodeId).toBe(pieceId)
    expect(reloadedContent?.pieces).toHaveLength(1)
  })

  it('leaves lastEditedNodeId untouched when not provided', async () => {
    const guide = await createGuide({ name: 'Pull' })
    const content = (await getGuideContent(guide.id))!
    await saveGuideContent(guide.id, content, 'node-1')
    await saveGuideContent(guide.id, content)
    const reloaded = await getGuide(guide.id)
    expect(reloaded?.lastEditedNodeId).toBe('node-1')
  })
})

describe('duplicateGuide', () => {
  it('creates a full copy with new node ids and a "Copie de" name, unlinked from any project', async () => {
    const guide = await createGuide({ name: 'Pull torsades' })
    const project = await createTestProject()
    await linkGuideToProject(project.id, guide.id)
    const original = (await getGuideContent(guide.id))!
    const { content: withPiece } = addPiece(original, 'Dos')
    await saveGuideContent(guide.id, withPiece)

    const copy = await duplicateGuide(guide.id)
    expect(copy.name).toBe('Copie de Pull torsades')
    expect(copy.id).not.toBe(guide.id)

    const copyContent = await getGuideContent(copy.id)
    expect(copyContent?.pieces[0]?.id).not.toBe(withPiece.pieces[0]?.id)
    expect(await getGuideProjectLinks(copy.id)).toHaveLength(0)
  })
})

describe('deleteGuide', () => {
  it('cascades to the content and every project link', async () => {
    const guide = await createGuide({ name: 'Pull' })
    const project = await createTestProject()
    await linkGuideToProject(project.id, guide.id)

    await deleteGuide(guide.id)

    expect(await getGuide(guide.id)).toBeUndefined()
    expect(await getGuideContent(guide.id)).toBeUndefined()
    expect(await getGuideProjectLinks(guide.id)).toHaveLength(0)
  })
})

describe('linkGuideToProject', () => {
  it('keeps a single link per project/guide pair', async () => {
    const guide = await createGuide({ name: 'Pull' })
    const project = await createTestProject()
    await linkGuideToProject(project.id, guide.id)
    await linkGuideToProject(project.id, guide.id)
    expect(await getProjectGuides(project.id)).toHaveLength(1)
  })
})

describe('deletePattern and guides', () => {
  it('clears patternId on linked guides instead of deleting them', async () => {
    const pattern = await importTestPattern()
    const guide = await createGuide({ name: 'Pull', patternId: pattern.id })

    await deletePattern(pattern.id)

    const reloaded = await getGuide(guide.id)
    expect(reloaded).toBeDefined()
    expect(reloaded?.patternId).toBeNull()
  })
})

describe('deleteProject and guides', () => {
  it('removes the project link but keeps the guide itself', async () => {
    const guide = await createGuide({ name: 'Pull' })
    const project = await createTestProject()
    await linkGuideToProject(project.id, guide.id)

    await deleteProject(project.id)

    expect(await getGuide(guide.id)).toBeDefined()
    expect(await getGuideProjectLinks(guide.id)).toHaveLength(0)
  })
})
