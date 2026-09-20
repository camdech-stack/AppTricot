// Pure time-tracking math, isolated from Dexie so it's easy to test and
// reusable at step 6 (global stats dashboard) without touching the data
// layer — same pattern as progress.ts for project progress.
export interface SessionLike {
  id: string
  projectId: string | null
  startedAt: string
  endedAt: string | null
  lastHeartbeatAt: string
}

// Effective end of a session: `now` for the session currently live in this
// browser context, `lastHeartbeatAt` for any other still-open one (e.g. an
// orphan not yet swept) — never a chronometer kept in memory.
export function getSessionDuration(session: SessionLike, now: number, liveSessionId: string | null): number {
  const startMs = new Date(session.startedAt).getTime()
  if (session.endedAt) {
    return Math.max(0, new Date(session.endedAt).getTime() - startMs)
  }
  const effectiveEndMs = session.id === liveSessionId ? now : new Date(session.lastHeartbeatAt).getTime()
  return Math.max(0, effectiveEndMs - startMs)
}

export interface TimeStats {
  totalMs: number
  sessionCount: number
  averageMs: number
  lastSessionAt: string | null
}

function computeStats(sessions: SessionLike[], now: number, liveSessionId: string | null): TimeStats {
  if (sessions.length === 0) {
    return { totalMs: 0, sessionCount: 0, averageMs: 0, lastSessionAt: null }
  }
  const totalMs = sessions.reduce((sum, session) => sum + getSessionDuration(session, now, liveSessionId), 0)
  const lastSessionAt = sessions.reduce<string | null>(
    (latest, session) => (!latest || session.startedAt > latest ? session.startedAt : latest),
    null,
  )
  return { totalMs, sessionCount: sessions.length, averageMs: totalMs / sessions.length, lastSessionAt }
}

// Project time stats only ever count sessions attached to a project — the
// standalone counter's time is never part of a project's total (see
// CLAUDE.md "Attribution du temps").
export function computeProjectTimeStats(
  sessions: SessionLike[],
  now: number,
  liveSessionId: string | null = null,
): TimeStats {
  return computeStats(
    sessions.filter((session) => session.projectId !== null),
    now,
    liveSessionId,
  )
}

export interface GlobalTimeStats extends TimeStats {
  projectsMs: number
  standaloneMs: number
}

// Global stats count every session, standalone counter included, plus the
// project/standalone split.
export function computeGlobalTimeStats(
  sessions: SessionLike[],
  now: number,
  liveSessionId: string | null = null,
): GlobalTimeStats {
  const base = computeStats(sessions, now, liveSessionId)
  const standaloneMs = sessions
    .filter((session) => session.projectId === null)
    .reduce((sum, session) => sum + getSessionDuration(session, now, liveSessionId), 0)
  return { ...base, projectsMs: base.totalMs - standaloneMs, standaloneMs }
}

export type TimePeriod = 'day' | 'week' | 'month'

export interface TimeRange {
  from: Date
  to: Date
}

export interface TimeBucket {
  // Local calendar key: YYYY-MM-DD for "day" (and the Monday of the week
  // for "week"), YYYY-MM for "month".
  key: string
  ms: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Splits a [startMs, endMs) span into per-local-day contributions, so a
// session crossing midnight lands on both days it actually covers.
function splitByLocalDay(startMs: number, endMs: number): Map<string, number> {
  const perDay = new Map<string, number>()
  let cursor = startMs
  while (cursor < endMs) {
    const dayStart = startOfLocalDay(new Date(cursor))
    const nextDayStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1).getTime()
    const segmentEnd = Math.min(endMs, nextDayStart)
    const key = localDayKey(dayStart)
    perDay.set(key, (perDay.get(key) ?? 0) + (segmentEnd - cursor))
    cursor = segmentEnd
  }
  return perDay
}

// The Monday (local) of the week containing `dayKey`.
function mondayKeyOf(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  const date = new Date(year!, month! - 1, day)
  const dayOfWeek = date.getDay() // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday)
  return localDayKey(monday)
}

function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7)
}

// Aggregates session time into day/week/month buckets over `range`
// (local time, `to` exclusive), splitting midnight-crossing sessions first.
export function aggregateTimeByPeriod(
  sessions: SessionLike[],
  period: TimePeriod,
  range: TimeRange,
  now: number = Date.now(),
  liveSessionId: string | null = null,
): TimeBucket[] {
  const rangeFromMs = range.from.getTime()
  const rangeToMs = range.to.getTime()
  const dayTotals = new Map<string, number>()

  for (const session of sessions) {
    const startMs = new Date(session.startedAt).getTime()
    const effectiveEndMs = session.endedAt
      ? new Date(session.endedAt).getTime()
      : session.id === liveSessionId
        ? now
        : new Date(session.lastHeartbeatAt).getTime()

    const clampedStart = Math.max(startMs, rangeFromMs)
    const clampedEnd = Math.min(effectiveEndMs, rangeToMs)
    if (clampedEnd <= clampedStart) continue

    for (const [day, ms] of splitByLocalDay(clampedStart, clampedEnd)) {
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + ms)
    }
  }

  if (period === 'day') {
    return [...dayTotals.entries()]
      .map(([key, ms]) => ({ key, ms }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  const groupKey = period === 'week' ? mondayKeyOf : monthKeyOf
  const grouped = new Map<string, number>()
  for (const [day, ms] of dayTotals) {
    const key = groupKey(day)
    grouped.set(key, (grouped.get(key) ?? 0) + ms)
  }
  return [...grouped.entries()].map(([key, ms]) => ({ key, ms })).sort((a, b) => a.key.localeCompare(b.key))
}
