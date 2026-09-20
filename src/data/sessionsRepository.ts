import type { Transaction } from 'dexie'
import { db } from './db'
import { createId } from './id'
import { nowIso } from './date'
import {
  clearManualStopIfDifferentTarget,
  clearManualStopTarget,
  getLiveSessionId,
  getManualStopTarget,
  isManuallyStoppedFor,
  isSameTarget,
  resetForegroundState,
  setLiveSessionId,
  setManualStopTarget,
  type SessionTarget,
} from './sessionTrackingState'
import type { SessionEndReason, SessionOrigin, SessionRecord } from './types'

const SETTINGS_ID = 'app-settings'

export type { SessionTarget }

async function isTrackingEnabled(tx: Transaction): Promise<boolean> {
  const settings = await tx.table('settings').get(SETTINGS_ID)
  return settings?.trackingEnabled !== false
}

// Closes every open session that isn't this context's own live session,
// using its last heartbeat as the end time (max 10s of loss, per spec).
// Called before every activity write and at app launch/foreground return —
// the only way an orphan can exist is iOS killing the app without warning.
async function closeOrphanSessionsInTx(tx: Transaction, now: string): Promise<void> {
  const table = tx.table('sessions')
  const liveId = getLiveSessionId()
  const openSessions = ((await table.toArray()) as SessionRecord[]).filter((session) => session.endedAt === null)
  for (const session of openSessions) {
    if (session.id === liveId) continue
    await table.update(session.id, {
      endedAt: session.lastHeartbeatAt,
      endReason: 'recovered',
      updatedAt: now,
    })
  }
}

export async function closeOrphanSessions(): Promise<void> {
  const now = nowIso()
  await db.transaction('rw', db.sessions, async (tx) => {
    await closeOrphanSessionsInTx(tx, now)
  })
}

export interface RecordActivityOptions {
  origin?: SessionOrigin
}

// Single entry point called from inside an existing counter-tap transaction
// (see countersRepository): guarantees a correct session is open for
// `target` per the rules in CLAUDE.md — reused as-is by the guide mode in
// step 5b, passing origin "guide" and the guide's projectId.
export async function recordActivity(
  target: SessionTarget,
  at: string,
  tx: Transaction,
  options: RecordActivityOptions = {},
): Promise<void> {
  if (!(await isTrackingEnabled(tx))) return

  await closeOrphanSessionsInTx(tx, at)
  clearManualStopIfDifferentTarget(target)

  const table = tx.table('sessions')
  const liveId = getLiveSessionId()
  const live = liveId ? ((await table.get(liveId)) as SessionRecord | undefined) : undefined

  if (live && !live.endedAt) {
    if (isSameTarget({ projectId: live.projectId }, target)) {
      await table.update(live.id, { lastHeartbeatAt: at, updatedAt: at })
      return
    }
    await table.update(live.id, { endedAt: at, endReason: 'switched' satisfies SessionEndReason, updatedAt: at })
    setLiveSessionId(null)
  }

  if (isManuallyStoppedFor(target)) return

  const session: SessionRecord = {
    id: createId(),
    projectId: target.projectId,
    startedAt: at,
    endedAt: null,
    lastHeartbeatAt: at,
    source: 'auto',
    origin: options.origin ?? 'counter',
    endReason: null,
    createdAt: at,
    updatedAt: at,
  }
  await table.add(session)
  setLiveSessionId(session.id)
}

// Explicit start, e.g. the chrono button: creates a "manual"-source session
// (as opposed to the "auto" one a counter tap opens) and always clears the
// manual-stop flag for this target.
export async function startSession(target: SessionTarget, origin: SessionOrigin): Promise<SessionRecord | undefined> {
  const now = nowIso()

  return db.transaction('rw', db.sessions, db.settings, async (tx) => {
    if (!(await isTrackingEnabled(tx))) return undefined

    await closeOrphanSessionsInTx(tx, now)
    const table = tx.table('sessions')
    const liveId = getLiveSessionId()
    const live = liveId ? ((await table.get(liveId)) as SessionRecord | undefined) : undefined

    if (live && !live.endedAt) {
      if (isSameTarget({ projectId: live.projectId }, target)) {
        clearManualStopTarget()
        return live as SessionRecord
      }
      await table.update(live.id, { endedAt: now, endReason: 'switched' satisfies SessionEndReason, updatedAt: now })
      setLiveSessionId(null)
    }

    clearManualStopTarget()

    const session: SessionRecord = {
      id: createId(),
      projectId: target.projectId,
      startedAt: now,
      endedAt: null,
      lastHeartbeatAt: now,
      source: 'manual',
      origin,
      endReason: null,
      createdAt: now,
      updatedAt: now,
    }
    await table.add(session)
    setLiveSessionId(session.id)
    return session
  })
}

// Closes this context's live session, if any, with `reason`. Only a
// "user_stop" sets the manual-stop flag (so same-target taps stop
// restarting it) — any other reason clears it, matching the foreground-loss
// rule even when nothing was actually running.
export async function stopSession(reason: SessionEndReason): Promise<void> {
  const liveId = getLiveSessionId()
  const now = nowIso()
  let target: SessionTarget | null = null

  if (liveId) {
    target = await db.transaction('rw', db.sessions, async (tx) => {
      const table = tx.table('sessions')
      const session = (await table.get(liveId)) as SessionRecord | undefined
      if (!session || session.endedAt) return null
      await table.update(session.id, { endedAt: now, endReason: reason, updatedAt: now })
      return { projectId: session.projectId }
    })
  }

  setLiveSessionId(null)
  if (reason === 'user_stop' && target) {
    setManualStopTarget(target)
  } else {
    clearManualStopTarget()
  }
}

// Called when the app leaves the foreground (visibilitychange/pagehide):
// ends the live session with "app_hidden" and unconditionally resets both
// in-memory flags, even if nothing was running.
export async function handleForegroundLoss(): Promise<void> {
  const liveId = getLiveSessionId()
  if (liveId) {
    const now = nowIso()
    await db.transaction('rw', db.sessions, async (tx) => {
      const table = tx.table('sessions')
      const session = (await table.get(liveId)) as SessionRecord | undefined
      if (session && !session.endedAt) {
        await table.update(session.id, { endedAt: now, endReason: 'app_hidden' satisfies SessionEndReason, updatedAt: now })
      }
    })
  }
  resetForegroundState()
}

// Recovery heartbeat, written every 10s while a session is open and the app
// is visible — never used as an inactivity timeout, purely so
// closeOrphanSessions can recover a session iOS killed without warning.
export async function touchHeartbeat(): Promise<void> {
  const liveId = getLiveSessionId()
  if (!liveId) return
  const now = nowIso()
  await db.transaction('rw', db.sessions, async (tx) => {
    const table = tx.table('sessions')
    const session = (await table.get(liveId)) as SessionRecord | undefined
    if (session && !session.endedAt) {
      await table.update(session.id, { lastHeartbeatAt: now, updatedAt: now })
    }
  })
}

export async function getOpenSession(): Promise<SessionRecord | undefined> {
  // Mirrors the null-projectId full-scan pattern in countersRepository: the
  // sessions table stays small for a personal app, and there is normally at
  // most one open session across the whole app.
  const sessions = await db.sessions.toArray()
  return sessions.find((session) => session.endedAt === null)
}

export async function getSessionsForTarget(target: SessionTarget): Promise<SessionRecord[]> {
  const sessions =
    target.projectId === null
      ? (await db.sessions.toArray()).filter((session) => session.projectId === null)
      : await db.sessions.where('projectId').equals(target.projectId).toArray()
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  return db.sessions.toArray()
}

export { isManuallyStoppedFor, getManualStopTarget, getLiveSessionId }

// Overlap check shared by add/edit: two sessions overlap when one starts
// before the other ends. An open session (no end yet) is treated as
// unbounded so it can never be silently double-counted by a manual entry.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export interface SessionTimesCandidate {
  id?: string
  startedAt: string
  endedAt: string
}

// Pure: no date in the future, end after start, and no overlap with any
// other session (any target) — so time is never counted twice. `now`/
// `others` are injected so this stays testable without touching Dexie.
export function validateSessionTimes(
  candidate: SessionTimesCandidate,
  others: SessionRecord[],
  now: number,
): string | null {
  const startMs = new Date(candidate.startedAt).getTime()
  const endMs = new Date(candidate.endedAt).getTime()

  if (startMs > now || endMs > now) {
    return 'La session ne peut pas se situer dans le futur.'
  }
  if (endMs <= startMs) {
    return 'La fin doit être après le début.'
  }

  const conflicting = others.some((session) => {
    if (session.id === candidate.id) return false
    const sessionEnd = session.endedAt ? new Date(session.endedAt).getTime() : now
    return overlaps(startMs, endMs, new Date(session.startedAt).getTime(), sessionEnd)
  })
  if (conflicting) {
    return 'Cette période chevauche une autre session.'
  }

  return null
}

export async function addManualSession(target: SessionTarget, startedAt: string, endedAt: string): Promise<SessionRecord> {
  const now = nowIso()
  const others = await getAllSessions()
  const error = validateSessionTimes({ startedAt, endedAt }, others, Date.now())
  if (error) throw new Error(error)

  const session: SessionRecord = {
    id: createId(),
    projectId: target.projectId,
    startedAt,
    endedAt,
    lastHeartbeatAt: endedAt,
    source: 'manual',
    origin: 'manual',
    endReason: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.sessions.add(session)
  return session
}

export async function updateSessionTimes(id: string, startedAt: string, endedAt: string): Promise<SessionRecord> {
  const current = await db.sessions.get(id)
  if (!current) throw new Error(`Session introuvable : ${id}`)

  const others = await getAllSessions()
  const error = validateSessionTimes({ id, startedAt, endedAt }, others, Date.now())
  if (error) throw new Error(error)

  const now = nowIso()
  const updated: SessionRecord = {
    ...current,
    startedAt,
    endedAt,
    lastHeartbeatAt: endedAt,
    updatedAt: now,
  }
  await db.sessions.put(updated)
  return updated
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

export async function deleteProjectSessions(projectId: string, tx: Transaction): Promise<void> {
  await tx.table('sessions').where('projectId').equals(projectId).delete()
}
