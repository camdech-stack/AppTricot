import type { Transaction } from 'dexie'
import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import { recordActivity } from './sessionsRepository'
import type { CounterEventRecord, CounterEventType, CounterRecord } from './types'

const MAIN_COUNTER_NAME = 'Rangs'
const STANDALONE_COUNTER_NAME = 'Compteur de rang'
const HISTORY_LIMIT = 100

export async function getCounters(projectId: string | null): Promise<CounterRecord[]> {
  // IndexedDB indexes never contain `null` keys, so a standalone counter
  // (projectId === null) can't be found via `.where('projectId').equals(null)`
  // — fall back to a full-table scan for that case only.
  const counters =
    projectId === null
      ? (await db.counters.toArray()).filter((counter) => counter.projectId === null)
      : await db.counters.where('projectId').equals(projectId).toArray()
  return counters.sort((a, b) => a.position - b.position)
}

export async function getCounter(id: string): Promise<CounterRecord | undefined> {
  return db.counters.get(id)
}

export async function getOrCreateStandaloneCounter(): Promise<CounterRecord> {
  const [existing] = await getCounters(null)
  if (existing) return existing

  const now = nowIso()
  const counter: CounterRecord = {
    id: createId(),
    projectId: null,
    name: STANDALONE_COUNTER_NAME,
    value: 0,
    goal: null,
    position: 0,
    isMain: true,
    lastTappedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.counters.add(counter)
  return counter
}

export async function addCounter(projectId: string, name: string): Promise<CounterRecord> {
  return db.transaction('rw', db.counters, async () => {
    const siblings = await getCounters(projectId)
    const position = siblings.reduce((max, counter) => Math.max(max, counter.position), -1) + 1
    const now = nowIso()
    const counter: CounterRecord = {
      id: createId(),
      projectId,
      name,
      value: 0,
      goal: null,
      position,
      isMain: false,
      lastTappedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.counters.add(counter)
    return counter
  })
}

export async function renameCounter(id: string, name: string): Promise<void> {
  await db.counters.update(id, { name, updatedAt: nowIso() })
}

export async function setCounterGoal(id: string, goal: number | null): Promise<void> {
  await db.counters.update(id, { goal, updatedAt: nowIso() })
}

export async function deleteCounter(id: string): Promise<void> {
  await db.transaction('rw', db.counters, db.counterEvents, db.projects, async () => {
    const counter = await db.counters.get(id)
    if (!counter) return
    if (counter.isMain) {
      throw new Error('Le compteur principal ne peut pas être supprimé.')
    }

    await db.counterEvents.where('counterId').equals(id).delete()
    await db.counters.delete(id)

    if (counter.projectId) {
      const project = await db.projects.get(counter.projectId)
      if (project?.activeCounterId === id) {
        const remaining = await getCounters(counter.projectId)
        const mainCounter = remaining.find((c) => c.isMain)
        await db.projects.update(counter.projectId, {
          activeCounterId: mainCounter?.id ?? null,
          updatedAt: nowIso(),
        })
      }
    }
  })
}

// The shared counter+event bookkeeping behind every +1/-1/+5 tap AND step
// 5b's linked-counter increments/decrements (a guide row's "next"/"back") —
// reads the current value from inside the caller's transaction (never from
// React state) so rapid taps, or a burst of guide steps, can never race or
// drop a count. Deliberately never touches sessions/recordActivity: each
// caller records its own activity with its own origin ('counter' vs
// 'guide'), see applyCounterDelta below and guideProgressRepository.ts.
export async function applyCounterDeltaInTx(tx: Transaction, id: string, delta: number): Promise<{ counter: CounterRecord; changed: boolean }> {
  const counters = tx.table('counters')
  const counter = (await counters.get(id)) as CounterRecord | undefined
  if (!counter) throw new Error(`Compteur introuvable : ${id}`)

  const valueBefore = counter.value
  const valueAfter = Math.max(0, valueBefore + delta)
  const appliedDelta = valueAfter - valueBefore
  if (appliedDelta === 0) return { counter, changed: false }

  const now = nowIso()
  const updated: CounterRecord = { ...counter, value: valueAfter, lastTappedAt: now, updatedAt: now }
  await counters.put(updated)

  await recordEventInTx(tx, id, appliedDelta > 0 ? 'increment' : 'decrement', appliedDelta, valueBefore, valueAfter, now)

  if (counter.projectId) {
    await tx.table('projects').update(counter.projectId, { lastActivityAt: now })
  }

  return { counter: updated, changed: true }
}

// The single write path for every +1/-1/+5 tap: applies the delta, then
// records the activity — a no-op delta (e.g. -1 already at zero) never
// touches sessions, matching the rule that opening a screen without
// tapping starts nothing.
export async function applyCounterDelta(id: string, delta: number): Promise<CounterRecord> {
  return db.transaction('rw', db.counters, db.counterEvents, db.projects, db.sessions, db.settings, async (tx) => {
    const { counter, changed } = await applyCounterDeltaInTx(tx, id, delta)
    if (!changed) return counter
    await recordActivity({ projectId: counter.projectId }, counter.updatedAt, tx, { origin: 'counter' })
    return counter
  })
}

export async function setCounterValue(id: string, value: number): Promise<CounterRecord> {
  return db.transaction('rw', db.counters, db.counterEvents, db.projects, db.sessions, db.settings, async (tx) => {
    const counter = await db.counters.get(id)
    if (!counter) throw new Error(`Compteur introuvable : ${id}`)

    const valueBefore = counter.value
    const valueAfter = Math.max(0, Math.round(value))
    const now = nowIso()

    const updated: CounterRecord = { ...counter, value: valueAfter, updatedAt: now }
    await db.counters.put(updated)

    await recordEventInTx(tx, counter.id, 'set', valueAfter - valueBefore, valueBefore, valueAfter, now)

    if (counter.projectId) {
      await db.projects.update(counter.projectId, { lastActivityAt: now })
    }

    await recordActivity({ projectId: counter.projectId }, now, tx, { origin: 'counter' })

    return updated
  })
}

export async function resetCounter(id: string): Promise<CounterRecord> {
  return db.transaction('rw', db.counters, db.counterEvents, db.projects, db.sessions, db.settings, async (tx) => {
    const counter = await db.counters.get(id)
    if (!counter) throw new Error(`Compteur introuvable : ${id}`)

    const valueBefore = counter.value
    const now = nowIso()

    const updated: CounterRecord = { ...counter, value: 0, updatedAt: now }
    await db.counters.put(updated)

    await recordEventInTx(tx, counter.id, 'reset', -valueBefore, valueBefore, 0, now)

    if (counter.projectId) {
      await db.projects.update(counter.projectId, { lastActivityAt: now })
    }

    await recordActivity({ projectId: counter.projectId }, now, tx, { origin: 'counter' })

    return updated
  })
}

// Assigns each event a strictly increasing per-counter sequence number,
// computed from inside the caller's transaction (so it stays correct even
// when several events are written back-to-back within the same
// millisecond, e.g. a burst of taps).
async function recordEventInTx(
  tx: Transaction,
  counterId: string,
  type: CounterEventType,
  delta: number,
  valueBefore: number,
  valueAfter: number,
  now: string,
): Promise<void> {
  const table = tx.table('counterEvents')
  const sequence = await table.where('counterId').equals(counterId).count()
  const event: CounterEventRecord = {
    id: createId(),
    counterId,
    type,
    delta,
    valueBefore,
    valueAfter,
    undoneAt: null,
    sequence,
    createdAt: now,
    updatedAt: now,
  }
  await table.add(event)
}

export async function getCounterEvents(counterId: string): Promise<CounterEventRecord[]> {
  const events = await db.counterEvents.where('counterId').equals(counterId).toArray()
  return events.sort((a, b) => b.sequence - a.sequence).slice(0, HISTORY_LIMIT)
}

// Reverts the most recent non-undone event by restoring its `valueBefore`,
// then marks it undoneAt. Repeatable: calling it again undoes the event
// that was previously second-to-last. No "redo" for now.
export async function undoLastEvent(counterId: string): Promise<CounterRecord | undefined> {
  return db.transaction('rw', db.counters, db.counterEvents, db.projects, db.sessions, db.settings, async (tx) => {
    const events = await db.counterEvents.where('counterId').equals(counterId).toArray()
    const lastActive = events.filter((event) => !event.undoneAt).sort((a, b) => b.sequence - a.sequence)[0]
    if (!lastActive) return undefined

    const counter = await db.counters.get(counterId)
    if (!counter) return undefined

    const now = nowIso()
    await db.counterEvents.update(lastActive.id, { undoneAt: now, updatedAt: now })

    const updated: CounterRecord = { ...counter, value: lastActive.valueBefore, updatedAt: now }
    await db.counters.put(updated)

    if (counter.projectId) {
      await db.projects.update(counter.projectId, { lastActivityAt: now })
    }

    await recordActivity({ projectId: counter.projectId }, now, tx, { origin: 'counter' })

    return updated
  })
}

export { MAIN_COUNTER_NAME }
