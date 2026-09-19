import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject, deleteProject, updateProject } from './projectsRepository'
import { addCounter, applyCounterDelta, getCounters } from './countersRepository'
import { todayDateString } from './date'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('createProject', () => {
  it('creates a main "Rangs" counter and sets it active', async () => {
    const project = await createProject({ name: 'Pull', craft: 'knitting', description: '', colorKey: 'pervenche' })

    const counters = await getCounters(project.id)
    expect(counters).toHaveLength(1)
    expect(counters[0]?.name).toBe('Rangs')
    expect(counters[0]?.isMain).toBe(true)
    expect(project.activeCounterId).toBe(counters[0]?.id)
  })

  it('defaults startedAt to today for a project created in_progress', async () => {
    const project = await createProject({ name: 'Pull', craft: 'knitting', description: '', colorKey: 'pervenche' })

    expect(project.status).toBe('in_progress')
    expect(project.startedAt).toBe(todayDateString())
  })

  it('leaves startedAt empty for a todo project', async () => {
    const project = await createProject({
      name: 'Pull',
      craft: 'knitting',
      description: '',
      colorKey: 'pervenche',
      status: 'todo',
    })

    expect(project.startedAt).toBeNull()
  })
})

describe('updateProject status date rules', () => {
  it('sets startedAt to today only on first transition to in_progress', async () => {
    const project = await createProject({
      name: 'Pull',
      craft: 'knitting',
      description: '',
      colorKey: 'pervenche',
      status: 'todo',
    })
    expect(project.startedAt).toBeNull()

    const inProgress = await updateProject(project.id, { status: 'in_progress' })
    expect(inProgress.startedAt).toBe(todayDateString())

    const manuallyEdited = await updateProject(project.id, { startedAt: '2020-01-01' })
    expect(manuallyEdited.startedAt).toBe('2020-01-01')

    await updateProject(project.id, { status: 'paused' })
    const backInProgress = await updateProject(project.id, { status: 'in_progress' })
    expect(backInProgress.startedAt).toBe('2020-01-01')
  })

  it('sets completedAt to today when marked done, unless explicitly provided', async () => {
    const project = await createProject({ name: 'Pull', craft: 'knitting', description: '', colorKey: 'pervenche' })

    const done = await updateProject(project.id, { status: 'done' })
    expect(done.completedAt).toBe(todayDateString())

    const doneWithExplicitDate = await updateProject(project.id, { status: 'done', completedAt: '2019-05-01' })
    expect(doneWithExplicitDate.completedAt).toBe('2019-05-01')
  })

  it('bumps lastActivityAt on every modification', async () => {
    const project = await createProject({ name: 'Pull', craft: 'knitting', description: '', colorKey: 'pervenche' })
    const before = project.lastActivityAt

    await new Promise((resolve) => setTimeout(resolve, 5))
    const updated = await updateProject(project.id, { notes: 'test' })

    expect(updated.lastActivityAt).not.toBe(before)
  })
})

describe('deleteProject', () => {
  it('cascades to its counters, their events and its cover image', async () => {
    const project = await createProject({ name: 'Pull', craft: 'knitting', description: '', colorKey: 'pervenche' })
    const extra = await addCounter(project.id, 'Manche')
    await applyCounterDelta(extra.id, 3)
    await db.coverImages.put({ id: project.id, projectId: project.id, blob: new Blob(['x']), createdAt: '', updatedAt: '' })

    await deleteProject(project.id)

    expect(await db.projects.get(project.id)).toBeUndefined()
    expect(await getCounters(project.id)).toHaveLength(0)
    expect(await db.counterEvents.where('counterId').equals(extra.id).toArray()).toHaveLength(0)
    expect(await db.coverImages.get(project.id)).toBeUndefined()
  })
})
