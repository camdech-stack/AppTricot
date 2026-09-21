import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import { emptyGuideContent, type GuideContent } from './guideModel'
import { cloneGuideContentWithNewIds } from './guideTree'
import type { GuideContentRecord, GuideRecord, ProjectCraft, ProjectGuideRecord } from './types'

export interface NewGuideInput {
  name: string
  craft?: ProjectCraft | null
  patternId?: string | null
  sizeLabel?: string | null
  notes?: string
}

export async function getGuides(): Promise<GuideRecord[]> {
  return db.guides.toArray()
}

export async function getGuide(id: string): Promise<GuideRecord | undefined> {
  return db.guides.get(id)
}

export async function getGuideContentRecord(guideId: string): Promise<GuideContentRecord | undefined> {
  return db.guideContents.get(guideId)
}

export async function getGuideContent(guideId: string): Promise<GuideContent | undefined> {
  const record = await db.guideContents.get(guideId)
  return record?.content
}

// Creates the guide and its (empty) content together in one transaction —
// a guide never exists without a content row, same convention as
// importPattern's metadata+file+cover write.
export async function createGuide(input: NewGuideInput): Promise<GuideRecord> {
  return db.transaction('rw', db.guides, db.guideContents, async () => {
    const now = nowIso()
    const id = createId()
    const guide: GuideRecord = {
      id,
      name: input.name,
      craft: input.craft ?? null,
      patternId: input.patternId ?? null,
      sizeLabel: input.sizeLabel ?? null,
      notes: input.notes ?? '',
      lastEditedNodeId: null,
      createdAt: now,
      updatedAt: now,
    }
    const contentRecord: GuideContentRecord = {
      id,
      guideId: id,
      schemaVersion: 1,
      content: emptyGuideContent(),
      createdAt: now,
      updatedAt: now,
    }
    await db.guides.add(guide)
    await db.guideContents.add(contentRecord)
    return guide
  })
}

export interface GuideMetaUpdateInput {
  name?: string
  craft?: ProjectCraft | null
  patternId?: string | null
  sizeLabel?: string | null
  notes?: string
}

export async function updateGuideMeta(id: string, patch: GuideMetaUpdateInput): Promise<GuideRecord> {
  const current = await db.guides.get(id)
  if (!current) throw new Error(`Guide introuvable : ${id}`)
  const updated: GuideRecord = { ...current, ...patch, updatedAt: nowIso() }
  await db.guides.put(updated)
  return updated
}

// Writes the whole content tree (autosave always saves it in full — see
// CLAUDE.md "Éditeur"). Pass lastEditedNodeId to record which node the
// editor should re-expand to on the next open; omit it to leave the
// current value untouched (e.g. a rename from the guide's menu, not the
// tree editor).
export async function saveGuideContent(guideId: string, content: GuideContent, lastEditedNodeId?: string | null): Promise<void> {
  await db.transaction('rw', db.guides, db.guideContents, async () => {
    const now = nowIso()
    const existing = await db.guideContents.get(guideId)
    const record: GuideContentRecord = {
      id: guideId,
      guideId,
      schemaVersion: 1,
      content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await db.guideContents.put(record)

    const patch: Record<string, unknown> = { updatedAt: now }
    if (lastEditedNodeId !== undefined) patch.lastEditedNodeId = lastEditedNodeId
    await db.guides.update(guideId, patch)
  })
}

// Deletes the content and every project link. Confirmation (listing the
// linked projects) is the caller's responsibility, same as deletePattern.
export async function deleteGuide(id: string): Promise<void> {
  await db.transaction('rw', db.guides, db.guideContents, db.projectGuides, async () => {
    await db.guideContents.delete(id)
    await db.projectGuides.where('guideId').equals(id).delete()
    await db.guides.delete(id)
  })
}

// A full copy with new ids on every node (never shares progress or
// identity with the original — see CLAUDE.md "Dupliquer un guide"),
// starting unlinked from any project.
export async function duplicateGuide(id: string): Promise<GuideRecord> {
  return db.transaction('rw', db.guides, db.guideContents, async () => {
    const current = await db.guides.get(id)
    if (!current) throw new Error(`Guide introuvable : ${id}`)
    const currentContent = await db.guideContents.get(id)
    const now = nowIso()
    const newId = createId()

    const guide: GuideRecord = {
      ...current,
      id: newId,
      name: `Copie de ${current.name}`,
      lastEditedNodeId: null,
      createdAt: now,
      updatedAt: now,
    }
    const content: GuideContentRecord = {
      id: newId,
      guideId: newId,
      schemaVersion: 1,
      content: currentContent ? cloneGuideContentWithNewIds(currentContent.content) : emptyGuideContent(),
      createdAt: now,
      updatedAt: now,
    }
    await db.guides.add(guide)
    await db.guideContents.add(content)
    return guide
  })
}

export async function getProjectGuides(projectId: string): Promise<ProjectGuideRecord[]> {
  const links = await db.projectGuides.where('projectId').equals(projectId).toArray()
  return links.sort((a, b) => a.position - b.position)
}

export async function getGuideProjectLinks(guideId: string): Promise<ProjectGuideRecord[]> {
  return db.projectGuides.where('guideId').equals(guideId).toArray()
}

export async function getAllProjectGuides(): Promise<ProjectGuideRecord[]> {
  return db.projectGuides.toArray()
}

// One link per (project, guide) pair: links the existing one instead of
// creating a duplicate when the pair is already present — same convention
// as linkPatternToProject/linkYarnToProject.
export async function linkGuideToProject(projectId: string, guideId: string): Promise<ProjectGuideRecord> {
  return db.transaction('rw', db.projectGuides, async () => {
    const existing = await db.projectGuides.where('[projectId+guideId]').equals([projectId, guideId]).first()
    if (existing) return existing
    const siblings = await getProjectGuides(projectId)
    const position = siblings.reduce((max, link) => Math.max(max, link.position), -1) + 1
    const now = nowIso()
    const link: ProjectGuideRecord = { id: createId(), projectId, guideId, position, createdAt: now, updatedAt: now }
    await db.projectGuides.add(link)
    return link
  })
}

export async function unlinkGuideFromProject(linkId: string): Promise<void> {
  await db.projectGuides.delete(linkId)
}
