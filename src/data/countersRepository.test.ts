import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject } from './projectsRepository'
import {
  addCounter,
  applyCounterDelta,
  deleteCounter,
  getCounterEvents,
  getCounters,
  getOrCreateStandaloneCounter,
  resetCounter,
  setCounterValue,
  undoLastEvent,
} from './countersRepository'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function createTestProject() {
  return createProject({ name: 'Écharpe', craft: 'knitting', description: '', colorKey: 'prune' })
}

describe('applyCounterDelta', () => {
  it('increments and decrements the value', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)
    await applyCounterDelta(main!.id, 1)
    const afterDecrement = await applyCounterDelta(main!.id, -1)

    expect(afterDecrement.value).toBe(1)
  })

  it('supports +5 taps', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    const updated = await applyCounterDelta(main!.id, 5)

    expect(updated.value).toBe(5)
  })

  it('never goes below zero', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    const updated = await applyCounterDelta(main!.id, -1)

    expect(updated.value).toBe(0)
  })

  it('bumps the project lastActivityAt', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const before = (await db.projects.get(project.id))!.lastActivityAt

    await new Promise((resolve) => setTimeout(resolve, 5))
    await applyCounterDelta(main!.id, 1)

    const after = (await db.projects.get(project.id))!.lastActivityAt
    expect(after).not.toBe(before)
  })

  it('handles a rapid burst of concurrent taps without losing any count', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await Promise.all(Array.from({ length: 30 }, () => applyCounterDelta(main!.id, 1)))

    const counter = await db.counters.get(main!.id)
    expect(counter?.value).toBe(30)
    const events = await getCounterEvents(main!.id)
    expect(events).toHaveLength(30)
  })
})

describe('resetCounter', () => {
  it('resets to zero and records an undoable event', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    await applyCounterDelta(main!.id, 7)

    const reset = await resetCounter(main!.id)
    expect(reset.value).toBe(0)

    const undone = await undoLastEvent(main!.id)
    expect(undone?.value).toBe(7)
  })
})

describe('setCounterValue', () => {
  it('sets an arbitrary value and floors negatives at zero', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    const set = await setCounterValue(main!.id, 42)
    expect(set.value).toBe(42)

    const flooredNegative = await setCounterValue(main!.id, -5)
    expect(flooredNegative.value).toBe(0)
  })
})

describe('undoLastEvent', () => {
  it('undoes successive actions one at a time, repeatably', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    await applyCounterDelta(main!.id, 1)
    await applyCounterDelta(main!.id, 1)
    await applyCounterDelta(main!.id, 1)

    expect((await undoLastEvent(main!.id))?.value).toBe(2)
    expect((await undoLastEvent(main!.id))?.value).toBe(1)
    expect((await undoLastEvent(main!.id))?.value).toBe(0)

    const events = await getCounterEvents(main!.id)
    expect(events.filter((event) => event.undoneAt)).toHaveLength(3)
  })

  it('does nothing when there is no event to undo', async () => {
    const counter = await getOrCreateStandaloneCounter()

    const result = await undoLastEvent(counter.id)

    expect(result).toBeUndefined()
  })
})

describe('deleteCounter', () => {
  it('refuses to delete the main counter', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await expect(deleteCounter(main!.id)).rejects.toThrow()
  })

  it('deletes a secondary counter and its events, and reassigns activeCounterId if needed', async () => {
    const project = await createTestProject()
    const extra = await addCounter(project.id, 'Manche')
    await applyCounterDelta(extra.id, 1)
    await db.projects.update(project.id, { activeCounterId: extra.id })

    await deleteCounter(extra.id)

    const remaining = await getCounters(project.id)
    expect(remaining).toHaveLength(1)
    const events = await db.counterEvents.where('counterId').equals(extra.id).toArray()
    expect(events).toHaveLength(0)
    const updatedProject = await db.projects.get(project.id)
    expect(updatedProject?.activeCounterId).toBe(remaining[0]?.id)
  })
})

describe('getOrCreateStandaloneCounter', () => {
  it('creates exactly one standalone counter across repeated calls', async () => {
    const first = await getOrCreateStandaloneCounter()
    const second = await getOrCreateStandaloneCounter()

    expect(second.id).toBe(first.id)
    expect(await getCounters(null)).toHaveLength(1)
  })
})
