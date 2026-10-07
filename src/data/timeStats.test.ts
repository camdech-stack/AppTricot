import { describe, expect, it } from 'vitest'
import {
  aggregateTimeByPeriod,
  computeGlobalTimeStats,
  computeGlobalTimeStatsInRange,
  countCompletedProjectsByPeriod,
  getStatsWindow,
  listBucketKeys,
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

describe('year buckets', () => {
  it('groups days into calendar years', () => {
    const sessions = [
      session({ id: 'a', startedAt: iso(new Date(2023, 11, 31, 10, 0)), endedAt: iso(new Date(2023, 11, 31, 11, 0)) }),
      session({ id: 'b', startedAt: iso(new Date(2024, 0, 2, 10, 0)), endedAt: iso(new Date(2024, 0, 2, 10, 30)) }),
    ]
    const buckets = aggregateTimeByPeriod(sessions, 'year', { from: new Date(2023, 0, 1), to: new Date(2025, 0, 1) })
    expect(buckets).toEqual([
      { key: '2023', ms: 60 * 60_000 },
      { key: '2024', ms: 30 * 60_000 },
    ])
  })
})

describe('countCompletedProjectsByPeriod', () => {
  const projects = [
    { completedAt: '2024-01-28' }, // Sunday of the week of Mon 2024-01-22
    { completedAt: '2024-01-29' }, // Monday of the next week
    { completedAt: '2024-01-31' },
    { completedAt: '2024-02-01' },
    { completedAt: null },
    { completedAt: '2023-12-31' }, // outside the range
  ]
  const range = { from: new Date(2024, 0, 1), to: new Date(2024, 2, 1) }

  it('counts per day', () => {
    expect(countCompletedProjectsByPeriod(projects, 'day', range).map((b) => b.key)).toEqual([
      '2024-01-28',
      '2024-01-29',
      '2024-01-31',
      '2024-02-01',
    ])
  })

  it('counts per week using the same Monday keys as time aggregation', () => {
    expect(countCompletedProjectsByPeriod(projects, 'week', range)).toEqual([
      { key: '2024-01-22', count: 1 },
      { key: '2024-01-29', count: 3 },
    ])
  })

  it('counts per month and per year, splitting data that straddles two periods', () => {
    expect(countCompletedProjectsByPeriod(projects, 'month', range)).toEqual([
      { key: '2024-01', count: 3 },
      { key: '2024-02', count: 1 },
    ])
    expect(countCompletedProjectsByPeriod(projects, 'year', { from: new Date(2023, 0, 1), to: new Date(2025, 0, 1) })).toEqual([
      { key: '2023', count: 1 },
      { key: '2024', count: 4 },
    ])
  })

  it('returns an empty list when nothing is completed', () => {
    expect(countCompletedProjectsByPeriod([], 'month', range)).toEqual([])
    expect(countCompletedProjectsByPeriod([{ completedAt: null }], 'month', range)).toEqual([])
  })
})

describe('listBucketKeys', () => {
  it('lists every day, week, month of a range including empty ones', () => {
    const range = { from: new Date(2024, 0, 29), to: new Date(2024, 1, 5) }
    expect(listBucketKeys('day', range)).toHaveLength(7)
    expect(listBucketKeys('week', range)).toEqual(['2024-01-29'])
    expect(listBucketKeys('month', range)).toEqual(['2024-01', '2024-02'])
    expect(listBucketKeys('year', range)).toEqual(['2024'])
  })
})

describe('getStatsWindow', () => {
  const now = new Date(2024, 1, 7, 15, 0) // Wednesday 2024-02-07

  it('week view is the Monday-first calendar week, by day', () => {
    const { range, period } = getStatsWindow('week', now)
    expect(period).toBe('day')
    expect(range.from).toEqual(new Date(2024, 1, 5))
    expect(range.to).toEqual(new Date(2024, 1, 12))
  })

  it('month view is the calendar month by day, year view the calendar year by month', () => {
    const month = getStatsWindow('month', now)
    expect(month.range).toEqual({ from: new Date(2024, 1, 1), to: new Date(2024, 2, 1) })
    expect(month.period).toBe('day')
    const year = getStatsWindow('year', now)
    expect(year.range).toEqual({ from: new Date(2024, 0, 1), to: new Date(2025, 0, 1) })
    expect(year.period).toBe('month')
  })

  it('all view starts at the earliest activity and switches to years past 24 months', () => {
    const shortHistory = getStatsWindow('all', now, new Date(2023, 8, 15).getTime())
    expect(shortHistory.range.from).toEqual(new Date(2023, 8, 1))
    expect(shortHistory.period).toBe('month')
    const longHistory = getStatsWindow('all', now, new Date(2020, 3, 15).getTime())
    expect(longHistory.period).toBe('year')
  })

  it('all view with no data at all falls back to the current month', () => {
    expect(getStatsWindow('all', now, null).range.from).toEqual(new Date(2024, 1, 1))
  })
})

describe('computeGlobalTimeStatsInRange', () => {
  it('clips a midnight-crossing session to the range and keeps the standalone split', () => {
    const sessions = [
      session({
        id: 'a',
        projectId: 'p1',
        startedAt: iso(new Date(2024, 0, 31, 23, 0)),
        endedAt: iso(new Date(2024, 1, 1, 1, 0)),
      }),
      session({ id: 'b', projectId: null, startedAt: iso(new Date(2024, 1, 2, 10, 0)), endedAt: iso(new Date(2024, 1, 2, 10, 30)) }),
    ]
    const stats = computeGlobalTimeStatsInRange(sessions, { from: new Date(2024, 1, 1), to: new Date(2024, 2, 1) }, Date.now())
    expect(stats.totalMs).toBe(60 * 60_000 + 30 * 60_000)
    expect(stats.standaloneMs).toBe(30 * 60_000)
    expect(stats.projectsMs).toBe(60 * 60_000)
    // The first session started in January: not counted as a February session.
    expect(stats.sessionCount).toBe(1)
  })

  it('matches computeGlobalTimeStats over a range covering everything', () => {
    const sessions = [
      session({ id: 'a', projectId: 'p1' }),
      session({ id: 'b', projectId: null, startedAt: iso(new Date(2024, 0, 3, 9, 0)), endedAt: iso(new Date(2024, 0, 3, 9, 20)) }),
    ]
    const all = computeGlobalTimeStats(sessions, Date.now())
    const ranged = computeGlobalTimeStatsInRange(sessions, { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) }, Date.now())
    expect(ranged.totalMs).toBe(all.totalMs)
    expect(ranged.sessionCount).toBe(all.sessionCount)
    expect(ranged.standaloneMs).toBe(all.standaloneMs)
  })

  it('returns zeros when there are no sessions', () => {
    const stats = computeGlobalTimeStatsInRange([], { from: new Date(2024, 0, 1), to: new Date(2024, 1, 1) }, Date.now())
    expect(stats).toMatchObject({ totalMs: 0, sessionCount: 0, averageMs: 0, lastSessionAt: null })
  })
})
