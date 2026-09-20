import { describe, expect, it } from 'vitest'
import {
  aggregateTimeByPeriod,
  computeGlobalTimeStats,
  computeProjectTimeStats,
  getSessionDuration,
  type SessionLike,
} from './timeStats'

function iso(localDate: Date): string {
  return localDate.toISOString()
}

function session(overrides: Partial<SessionLike> & { id: string }): SessionLike {
  return {
    projectId: null,
    startedAt: iso(new Date(2024, 0, 1, 10, 0)),
    endedAt: iso(new Date(2024, 0, 1, 10, 30)),
    lastHeartbeatAt: iso(new Date(2024, 0, 1, 10, 30)),
    ...overrides,
  }
}

describe('getSessionDuration', () => {
  it('uses endedAt - startedAt for a closed session', () => {
    const s = session({
      id: 'a',
      startedAt: iso(new Date(2024, 0, 1, 10, 0)),
      endedAt: iso(new Date(2024, 0, 1, 10, 5)),
    })
    expect(getSessionDuration(s, Date.now(), null)).toBe(5 * 60_000)
  })

  it('uses `now` for the currently live session', () => {
    const start = new Date(2024, 0, 1, 10, 0)
    const now = new Date(2024, 0, 1, 10, 7).getTime()
    const s = session({ id: 'live', startedAt: iso(start), endedAt: null, lastHeartbeatAt: iso(start) })
    expect(getSessionDuration(s, now, 'live')).toBe(7 * 60_000)
  })

  it('uses lastHeartbeatAt for an open session that is not the live one', () => {
    const start = new Date(2024, 0, 1, 10, 0)
    const heartbeat = new Date(2024, 0, 1, 10, 4)
    const now = new Date(2024, 0, 1, 10, 20).getTime()
    const s = session({ id: 'orphan', startedAt: iso(start), endedAt: null, lastHeartbeatAt: iso(heartbeat) })
    expect(getSessionDuration(s, now, 'some-other-live-id')).toBe(4 * 60_000)
  })
})

describe('computeProjectTimeStats', () => {
  it('excludes the standalone counter time (projectId null)', () => {
    const sessions = [
      session({ id: '1', projectId: 'project-a' }),
      session({ id: '2', projectId: null }),
    ]
    const stats = computeProjectTimeStats(sessions, Date.now())
    expect(stats.sessionCount).toBe(1)
    expect(stats.totalMs).toBe(30 * 60_000)
  })

  it('returns zeroed stats for an empty list', () => {
    const stats = computeProjectTimeStats([], Date.now())
    expect(stats).toEqual({ totalMs: 0, sessionCount: 0, averageMs: 0, lastSessionAt: null })
  })
})

describe('computeGlobalTimeStats', () => {
  it('counts the standalone counter time in the global total but splits it out separately', () => {
    const sessions = [
      session({ id: '1', projectId: 'project-a' }),
      session({ id: '2', projectId: null }),
    ]
    const stats = computeGlobalTimeStats(sessions, Date.now())
    expect(stats.sessionCount).toBe(2)
    expect(stats.totalMs).toBe(60 * 60_000)
    expect(stats.projectsMs).toBe(30 * 60_000)
    expect(stats.standaloneMs).toBe(30 * 60_000)
  })
})

describe('aggregateTimeByPeriod', () => {
  it('splits a session crossing midnight across the two days it covers', () => {
    const s = session({
      id: 'midnight',
      startedAt: iso(new Date(2024, 0, 1, 23, 30)),
      endedAt: iso(new Date(2024, 0, 2, 0, 30)),
    })
    const buckets = aggregateTimeByPeriod(
      [s],
      'day',
      { from: new Date(2024, 0, 1), to: new Date(2024, 0, 3) },
    )
    expect(buckets).toEqual([
      { key: '2024-01-01', ms: 30 * 60_000 },
      { key: '2024-01-02', ms: 30 * 60_000 },
    ])
  })

  it('aggregates by week starting on Monday', () => {
    // Monday 2024-01-01 and Wednesday 2024-01-03 fall in the same week.
    const monday = session({
      id: 'monday',
      startedAt: iso(new Date(2024, 0, 1, 9, 0)),
      endedAt: iso(new Date(2024, 0, 1, 10, 0)),
    })
    const wednesday = session({
      id: 'wednesday',
      startedAt: iso(new Date(2024, 0, 3, 9, 0)),
      endedAt: iso(new Date(2024, 0, 3, 10, 0)),
    })
    // Sunday 2023-12-31 falls in the previous week.
    const sunday = session({
      id: 'sunday',
      startedAt: iso(new Date(2023, 11, 31, 9, 0)),
      endedAt: iso(new Date(2023, 11, 31, 10, 0)),
    })

    const buckets = aggregateTimeByPeriod(
      [monday, wednesday, sunday],
      'week',
      { from: new Date(2023, 11, 25), to: new Date(2024, 0, 8) },
    )

    expect(buckets).toEqual([
      { key: '2023-12-25', ms: 60 * 60_000 },
      { key: '2024-01-01', ms: 2 * 60 * 60_000 },
    ])
  })
})
