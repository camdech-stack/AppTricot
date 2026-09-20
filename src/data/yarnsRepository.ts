import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import { amountToSkeins, skeinsToAmount } from './yarnMath'
import type {
  ProjectYarnRecord,
  YarnDraft,
  YarnImageRecord,
  YarnQuantityUnitValue,
  YarnRecord,
  YarnUsageRecord,
} from './types'

export interface NewYarnInput {
  name: string
  brand?: string
  line?: string
  colorName?: string
  colorRef?: string
  colorFamily?: YarnRecord['colorFamily']
  weightCategory?: YarnRecord['weightCategory']
  fiber?: string
  skeinCount?: number
  metersPerSkein?: number | null
  gramsPerSkein?: number | null
  dyeLot?: string
  notes?: string
  price?: number | null
  purchasedAt?: string | null
  ravelryYarnId?: string | null
  catalogSource?: YarnRecord['catalogSource']
}

export type YarnUpdateInput = Partial<NewYarnInput>

function withDefaults(input: NewYarnInput, id: string, now: string): YarnRecord {
  return {
    id,
    name: input.name,
    brand: input.brand ?? '',
    line: input.line ?? '',
    colorName: input.colorName ?? '',
    colorRef: input.colorRef ?? '',
    colorFamily: input.colorFamily ?? null,
    weightCategory: input.weightCategory ?? null,
    fiber: input.fiber ?? '',
    skeinCount: input.skeinCount ?? 0,
    metersPerSkein: input.metersPerSkein ?? null,
    gramsPerSkein: input.gramsPerSkein ?? null,
    dyeLot: input.dyeLot ?? '',
    notes: input.notes ?? '',
    price: input.price ?? null,
    purchasedAt: input.purchasedAt ?? null,
    ravelryYarnId: input.ravelryYarnId ?? null,
    catalogSource: input.catalogSource ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }
}

// Converts a saved YarnRecord into a YarnDraft, for the "duplicate for
// another color" action: everything except quantities/color/dye lot carries
// over into a fresh, unsaved draft.
export function toDuplicateDraft(yarn: YarnRecord): YarnDraft {
  return {
    name: yarn.name,
    brand: yarn.brand,
    line: yarn.line,
    fiber: yarn.fiber,
    weightCategory: yarn.weightCategory,
    metersPerSkein: yarn.metersPerSkein,
    gramsPerSkein: yarn.gramsPerSkein,
    catalogSource: 'manual',
  }
}

export async function getYarns(): Promise<YarnRecord[]> {
  return db.yarns.toArray()
}

export async function getYarn(id: string): Promise<YarnRecord | undefined> {
  return db.yarns.get(id)
}

export async function createYarn(input: NewYarnInput): Promise<YarnRecord> {
  const now = nowIso()
  const yarn = withDefaults(input, createId(), now)
  await db.yarns.add(yarn)
  return yarn
}

export async function updateYarn(id: string, patch: YarnUpdateInput): Promise<YarnRecord> {
  const current = await db.yarns.get(id)
  if (!current) throw new Error(`Fil introuvable : ${id}`)
  const updated: YarnRecord = { ...current, ...patch, updatedAt: nowIso() }
  await db.yarns.put(updated)
  return updated
}

export async function deleteYarn(id: string): Promise<void> {
  await db.transaction('rw', db.yarns, db.yarnImages, db.projectYarns, db.yarnUsages, async () => {
    await db.projectYarns.where('yarnId').equals(id).delete()
    await db.yarnUsages.where('yarnId').equals(id).delete()
    await db.yarnImages.delete(id)
    await db.yarns.delete(id)
  })
}

// The photo is 1:1 with its yarn, same pattern as project cover images: the
// yarn's own id doubles as the photo's primary key.
export async function setYarnImage(yarnId: string, blob: Blob): Promise<YarnImageRecord> {
  const now = nowIso()
  const existing = await db.yarnImages.get(yarnId)
  const record: YarnImageRecord = { id: yarnId, yarnId, blob, createdAt: existing?.createdAt ?? now, updatedAt: now }
  await db.yarnImages.put(record)
  return record
}

export async function getYarnImage(yarnId: string): Promise<YarnImageRecord | undefined> {
  return db.yarnImages.get(yarnId)
}

export async function deleteYarnImage(yarnId: string): Promise<void> {
  await db.yarnImages.delete(yarnId)
}

export async function getProjectYarns(projectId: string): Promise<ProjectYarnRecord[]> {
  return db.projectYarns.where('projectId').equals(projectId).toArray()
}

export async function getYarnProjectLinks(yarnId: string): Promise<ProjectYarnRecord[]> {
  return db.projectYarns.where('yarnId').equals(yarnId).toArray()
}

// One link per (project, yarn) pair: links an existing one instead of
// creating a duplicate when the pair is already present.
export async function linkYarnToProject(
  projectId: string,
  yarnId: string,
  plannedValue: number,
  plannedUnit: YarnQuantityUnitValue,
): Promise<ProjectYarnRecord> {
  return db.transaction('rw', db.projectYarns, async () => {
    const existing = await db.projectYarns.where('[projectId+yarnId]').equals([projectId, yarnId]).first()
    const now = nowIso()
    if (existing) {
      const updated: ProjectYarnRecord = { ...existing, plannedValue, plannedUnit, updatedAt: now }
      await db.projectYarns.put(updated)
      return updated
    }
    const link: ProjectYarnRecord = {
      id: createId(),
      projectId,
      yarnId,
      plannedValue,
      plannedUnit,
      createdAt: now,
      updatedAt: now,
    }
    await db.projectYarns.add(link)
    return link
  })
}

export async function updateProjectYarnPlanned(
  linkId: string,
  plannedValue: number,
  plannedUnit: YarnQuantityUnitValue,
): Promise<void> {
  await db.projectYarns.update(linkId, { plannedValue, plannedUnit, updatedAt: nowIso() })
}

export async function unlinkYarnFromProject(linkId: string): Promise<void> {
  await db.projectYarns.delete(linkId)
}

export interface NewYarnUsageInput {
  yarnId: string
  projectId: string | null
  value: number
  unit: YarnQuantityUnitValue
  usedAt: string
  note?: string
}

export async function addYarnUsage(input: NewYarnUsageInput): Promise<YarnUsageRecord> {
  const now = nowIso()
  const usage: YarnUsageRecord = {
    id: createId(),
    yarnId: input.yarnId,
    projectId: input.projectId,
    value: input.value,
    unit: input.unit,
    usedAt: input.usedAt,
    note: input.note ?? '',
    createdAt: now,
    updatedAt: now,
  }
  await db.yarnUsages.add(usage)
  return usage
}

export async function updateYarnUsage(
  id: string,
  patch: Partial<Pick<YarnUsageRecord, 'value' | 'unit' | 'usedAt' | 'note'>>,
): Promise<void> {
  await db.yarnUsages.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteYarnUsage(id: string): Promise<void> {
  await db.yarnUsages.delete(id)
}

export async function getYarnUsages(yarnId: string): Promise<YarnUsageRecord[]> {
  const usages = await db.yarnUsages.where('yarnId').equals(yarnId).toArray()
  return usages.sort((a, b) => b.usedAt.localeCompare(a.usedAt))
}

export async function getAllYarnUsages(): Promise<YarnUsageRecord[]> {
  return db.yarnUsages.toArray()
}

export async function getAllProjectYarns(): Promise<ProjectYarnRecord[]> {
  return db.projectYarns.toArray()
}

export interface ProjectYarnSummary {
  plannedSkeins: number
  consumedSkeins: number
  remainingSkeins: number
  ratio: number | null
}

// Sums every yarn planned/consumed for a project into skeins (the only unit
// that can combine different yarns), for the step 6 stats card. A yarn
// whose skein figures are missing contributes its consumption but no
// meaningful planned/remaining number.
export async function computeProjectYarnSummary(projectId: string): Promise<ProjectYarnSummary> {
  const links = await getProjectYarns(projectId)
  const usages = (await db.yarnUsages.where('projectId').equals(projectId).toArray()) as YarnUsageRecord[]
  const yarns = await Promise.all(links.map((link) => db.yarns.get(link.yarnId)))

  let plannedSkeins = 0
  let consumedSkeins = 0

  links.forEach((link, index) => {
    const yarn = yarns[index]
    if (!yarn) return
    plannedSkeins += amountToSkeins(link.plannedValue, link.plannedUnit, yarn) ?? 0
    consumedSkeins += usages
      .filter((usage) => usage.yarnId === yarn.id)
      .reduce((sum, usage) => sum + (amountToSkeins(usage.value, usage.unit, yarn) ?? 0), 0)
  })

  const remainingSkeins = Math.max(plannedSkeins - consumedSkeins, 0)
  const ratio = plannedSkeins > 0 ? consumedSkeins / plannedSkeins : null

  return { plannedSkeins, consumedSkeins, remainingSkeins, ratio }
}

export { amountToSkeins, skeinsToAmount }
