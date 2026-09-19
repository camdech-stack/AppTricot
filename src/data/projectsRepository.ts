import { db } from './db'
import { createId } from './id'
import { nowIso, todayDateString } from './date'
import { getCounters, MAIN_COUNTER_NAME } from './countersRepository'
import type { CounterRecord, ProjectCraft, ProjectColorKey, ProjectRecord, ProjectStatus } from './types'

export interface NewProjectInput {
  name: string
  craft: ProjectCraft
  description: string
  colorKey: ProjectColorKey
  status?: ProjectStatus
  startedAt?: string | null
  completedAt?: string | null
}

export interface ProjectUpdateInput {
  name?: string
  craft?: ProjectCraft
  description?: string
  status?: ProjectStatus
  colorKey?: ProjectColorKey
  notes?: string
  startedAt?: string | null
  completedAt?: string | null
  activeCounterId?: string | null
}

export async function getProjects(): Promise<ProjectRecord[]> {
  return db.projects.toArray()
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return db.projects.get(id)
}

export async function createProject(input: NewProjectInput): Promise<ProjectRecord> {
  return db.transaction('rw', db.projects, db.counters, async () => {
    const now = nowIso()
    const status = input.status ?? 'in_progress'
    const projectId = createId()
    const counterId = createId()

    const project: ProjectRecord = {
      id: projectId,
      name: input.name,
      craft: input.craft,
      description: input.description,
      status,
      colorKey: input.colorKey,
      notes: '',
      startedAt: input.startedAt ?? (status === 'in_progress' ? todayDateString() : null),
      completedAt: input.completedAt ?? (status === 'done' ? todayDateString() : null),
      lastActivityAt: now,
      activeCounterId: counterId,
      createdAt: now,
      updatedAt: now,
    }

    const mainCounter: CounterRecord = {
      id: counterId,
      projectId,
      name: MAIN_COUNTER_NAME,
      value: 0,
      goal: null,
      position: 0,
      isMain: true,
      lastTappedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.projects.add(project)
    await db.counters.add(mainCounter)
    return project
  })
}

// First transition to "in_progress" defaults startedAt to today (if it was
// still empty); every transition to "done" defaults completedAt to today.
// Both are skipped when the caller's patch already sets that date by hand.
function applyStatusDateRules(current: ProjectRecord, patch: ProjectUpdateInput): ProjectUpdateInput {
  const next = { ...patch }
  if (patch.status === 'in_progress' && !current.startedAt && next.startedAt === undefined) {
    next.startedAt = todayDateString()
  }
  if (patch.status === 'done' && next.completedAt === undefined) {
    next.completedAt = todayDateString()
  }
  return next
}

export async function updateProject(id: string, patch: ProjectUpdateInput): Promise<ProjectRecord> {
  const current = await db.projects.get(id)
  if (!current) throw new Error(`Projet introuvable : ${id}`)

  const now = nowIso()
  const updated: ProjectRecord = {
    ...current,
    ...applyStatusDateRules(current, patch),
    updatedAt: now,
    lastActivityAt: now,
  }
  await db.projects.put(updated)
  return updated
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.counters, db.counterEvents, db.coverImages, async () => {
    const counters = await getCounters(id)
    const counterIds = counters.map((counter) => counter.id)
    if (counterIds.length > 0) {
      await db.counterEvents.where('counterId').anyOf(counterIds).delete()
      await db.counters.bulkDelete(counterIds)
    }
    await db.coverImages.delete(id)
    await db.projects.delete(id)
  })
}
