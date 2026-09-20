import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject } from './projectsRepository'
import { deleteProject } from './projectsRepository'
import { applyCounterDelta, getCounters, getOrCreateStandaloneCounter, undoLastEvent, addCounter } from './countersRepository'
import { updateSettings } from './settingsRepository'
import { resetForegroundState } from './sessionTrackingState'
import {
  addManualSession,
  closeOrphanSessions,
  getAllSessions,
  getSessionsForTarget,
  handleForegroundLoss,
  startSession,
  stopSession,
} from './sessionsRepository'

beforeEach(async () => {
  await db.delete()
  await db.open()
  resetForegroundState()
})

async function createTestProject() {
  return createProject({ name: 'Écharpe', craft: 'knitting', description: '', colorKey: 'prune' })
}

describe('recordActivity (via counter taps)', () => {
  it('creates a session on the first tap on a project counter', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      projectId: project.id,
      source: 'auto',
      origin: 'counter',
      endedAt: null,
    })
  })

  it('creates a session on the first tap on the standalone counter', async () => {
    const counter = await getOrCreateStandaloneCounter()
    await applyCounterDelta(counter.id, 1)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.projectId).toBeNull()
  })

  it('rapid taps only ever create a single session', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await Promise.all([
      applyCounterDelta(main!.id, 1),
      applyCounterDelta(main!.id, 1),
      applyCounterDelta(main!.id, 1),
    ])

    expect(await db.sessions.count()).toBe(1)
  })

  it('two counters within the same project continue the same session', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const other = await addCounter(project.id, 'Manche')

    await applyCounterDelta(main!.id, 1)
    await applyCounterDelta(other.id, 1)

    expect(await db.sessions.count()).toBe(1)
  })

  it('tapping a counter of a different target closes the previous session without overlap', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const standalone = await getOrCreateStandaloneCounter()

    await applyCounterDelta(main!.id, 1)
    await applyCounterDelta(standalone.id, 1)

    const sessions = (await db.sessions.toArray()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.projectId).toBe(project.id)
    expect(sessions[0]?.endedAt).not.toBeNull()
    expect(sessions[0]?.endReason).toBe('switched')
    expect(sessions[1]?.projectId).toBeNull()
    expect(sessions[1]?.endedAt).toBeNull()
    // No overlap: the closed session ends no later than the new one starts.
    expect(sessions[0]!.endedAt! <= sessions[1]!.startedAt).toBe(true)
  })

  it('undo counts as activity but still respects a manual stop on the same target', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    expect((await db.sessions.toArray())[0]?.endedAt).not.toBeNull()

    await undoLastEvent(main!.id)

    expect(await db.sessions.count()).toBe(1)
  })

  it('does nothing when tracking is disabled', async () => {
    await updateSettings({ trackingEnabled: false })
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)

    expect(await db.sessions.count()).toBe(0)
  })
})

describe('manual stop / restart', () => {
  it('does not restart the chrono when tapping the same target after a manual stop', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    await applyCounterDelta(main!.id, 1)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.endedAt).not.toBeNull()
  })

  it('restarting the chrono by hand opens a new session', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const target = { projectId: project.id }

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    await startSession(target, 'counter')

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(2)
    expect(sessions.filter((s) => s.endedAt === null)).toHaveLength(1)
    expect(sessions.find((s) => s.endedAt === null)?.source).toBe('manual')
  })

  it('clears the manual-stop flag when tapping a counter of a different target', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const standalone = await getOrCreateStandaloneCounter()

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    // Different target: this both opens a session for the standalone
    // counter AND clears the manual-stop flag that was set for the project.
    await applyCounterDelta(standalone.id, 1)
    // Tapping the project's counter again should now restart it.
    await applyCounterDelta(main!.id, 1)

    const projectSessions = await getSessionsForTarget({ projectId: project.id })
    expect(projectSessions).toHaveLength(2)
    expect(projectSessions.some((s) => s.endedAt === null)).toBe(true)
  })

  it('clears the manual-stop flag on foreground loss', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    await handleForegroundLoss()
    await applyCounterDelta(main!.id, 1)

    const sessions = await getSessionsForTarget({ projectId: project.id })
    expect(sessions).toHaveLength(2)
    expect(sessions.some((s) => s.endedAt === null)).toBe(true)
  })
})

describe('foreground loss', () => {
  it('ends the open session with endReason "app_hidden"', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)

    await applyCounterDelta(main!.id, 1)
    await handleForegroundLoss()

    const sessions = await db.sessions.toArray()
    expect(sessions[0]?.endedAt).not.toBeNull()
    expect(sessions[0]?.endReason).toBe('app_hidden')
  })
})

describe('closeOrphanSessions', () => {
  it('closes a stale open session using its last heartbeat as the end time', async () => {
    const staleHeartbeat = '2024-01-01T10:05:00.000Z'
    await db.sessions.add({
      id: 'orphan',
      projectId: null,
      startedAt: '2024-01-01T10:00:00.000Z',
      endedAt: null,
      lastHeartbeatAt: staleHeartbeat,
      source: 'auto',
      origin: 'counter',
      endReason: null,
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    })

    // No in-memory liveSessionId points to it (e.g. the app was killed and
    // relaunched): this context owns nothing, so it's a pure orphan.
    await closeOrphanSessions()

    const session = await db.sessions.get('orphan')
    expect(session?.endedAt).toBe(staleHeartbeat)
    expect(session?.endReason).toBe('recovered')
  })
})

describe('addManualSession', () => {
  it('rejects a session that overlaps another one', async () => {
    await addManualSession({ projectId: null }, '2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z')

    await expect(
      addManualSession({ projectId: null }, '2024-01-01T10:15:00.000Z', '2024-01-01T10:45:00.000Z'),
    ).rejects.toThrow()

    expect(await getAllSessions()).toHaveLength(1)
  })
})

describe('project deletion', () => {
  it('cascades to the project sessions but keeps the standalone counter sessions', async () => {
    const project = await createTestProject()
    const [main] = await getCounters(project.id)
    const standalone = await getOrCreateStandaloneCounter()

    await applyCounterDelta(main!.id, 1)
    await stopSession('user_stop')
    await applyCounterDelta(standalone.id, 1)

    await deleteProject(project.id)

    expect(await getSessionsForTarget({ projectId: project.id })).toHaveLength(0)
    expect(await getSessionsForTarget({ projectId: null })).toHaveLength(1)
  })
})
