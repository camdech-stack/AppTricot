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

export type TimePeriod = 'day' | 'week' | 'month' | 'year'

export interface TimeRange {
  from: Date
  to: Date
}

export interface TimeBucket {
  // Local calendar key: YYYY-MM-DD for "day" (and the Monday of the week
  // for "week"), YYYY-MM for "month", YYYY for "year".
  key: string
  ms: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function localDayKey(date: Date): string {
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

export function bucketKeyOfDay(dayKey: string, period: TimePeriod): string {
  switch (period) {
    case 'day':
      return dayKey
    case 'week':
      return mondayKeyOf(dayKey)
    case 'month':
      return dayKey.slice(0, 7)
    case 'year':
      return dayKey.slice(0, 4)
  }
}

// The one place that folds per-day totals into week/month/year buckets,
// shared by time aggregation and "completed projects" counting so the two
// never disagree on where a period starts.
function groupDayValues(dayValues: Map<string, number>, period: TimePeriod): { key: string; value: number }[] {
  const grouped = new Map<string, number>()
  for (const [day, value] of dayValues) {
    const key = bucketKeyOfDay(day, period)
    grouped.set(key, (grouped.get(key) ?? 0) + value)
  }
  return [...grouped.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key))
}

// Aggregates session time into day/week/month/year buckets over `range`
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

  return groupDayValues(dayTotals, period).map(({ key, value }) => ({ key, ms: value }))
}

export interface CompletedBucket {
  key: string
  count: number
}

export interface CompletedProjectLike {
  // Calendar date (YYYY-MM-DD) of the real end, null while not done.
  completedAt: string | null
}

// Number of projects completed (completedAt, a calendar date) per
// day/week/month/year bucket over `range` (`to` exclusive).
export function countCompletedProjectsByPeriod(
  projects: CompletedProjectLike[],
  period: TimePeriod,
  range: TimeRange,
): CompletedBucket[] {
  const fromKey = localDayKey(range.from)
  const toKey = localDayKey(range.to)
  const perDay = new Map<string, number>()
  for (const project of projects) {
    const day = project.completedAt
    if (!day || day < fromKey || day >= toKey) continue
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  return groupDayValues(perDay, period).map(({ key, value }) => ({ key, count: value }))
}

// Every bucket key covering `range`, in order, so a chart can show empty
// periods as empty bars instead of silently skipping them.
export function listBucketKeys(period: TimePeriod, range: TimeRange): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (
    let day = startOfLocalDay(range.from);
    day.getTime() < range.to.getTime();
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    const key = bucketKeyOfDay(localDayKey(day), period)
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

// --- Global stats views (step 6) ---------------------------------------------

export type StatsView = 'week' | 'month' | 'year' | 'all'

export interface StatsWindow {
  range: TimeRange
  // Granularity of the charts for this view.
  period: TimePeriod
}

const ALL_VIEW_MAX_MONTH_BARS = 24

// Range + chart granularity for each global-stats view, in local time:
// the current calendar week (Monday first) by day, month by day, year by
// month, and "all" from the earliest recorded activity (by month, or by
// year once that would make more than two years of bars).
export function getStatsWindow(view: StatsView, now: Date, earliestMs: number | null = null): StatsWindow {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (view === 'week') {
    const monday = new Date(`${mondayKeyOf(localDayKey(now))}T00:00:00`)
    return { range: { from: monday, to: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7) }, period: 'day' }
  }
  if (view === 'month') {
    return {
      range: { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
      period: 'day',
    }
  }
  if (view === 'year') {
    return { range: { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) }, period: 'month' }
  }
  const earliest = earliestMs === null ? now : new Date(Math.min(earliestMs, now.getTime()))
  const from = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const monthSpan = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth()) + 1
  return { range: { from, to }, period: monthSpan > ALL_VIEW_MAX_MONTH_BARS ? 'year' : 'month' }
}

// Global time stats restricted to `range`: totals are clipped to the range
// (so they always equal the sum of the chart's bars, even for a session
// straddling a boundary), while the session count is the sessions that
// START inside it.
export function computeGlobalTimeStatsInRange(
  sessions: SessionLike[],
  range: TimeRange,
  now: number,
  liveSessionId: string | null = null,
): GlobalTimeStats {
  const sumMs = (subset: SessionLike[]) =>
    aggregateTimeByPeriod(subset, 'day', range, now, liveSessionId).reduce((sum, bucket) => sum + bucket.ms, 0)

  const fromMs = range.from.getTime()
  const toMs = range.to.getTime()
  const started = sessions.filter((session) => {
    const startMs = new Date(session.startedAt).getTime()
    return startMs >= fromMs && startMs < toMs
  })
  const totalMs = sumMs(sessions)
  const standaloneMs = sumMs(sessions.filter((session) => session.projectId === null))
  const lastSessionAt = started.reduce<string | null>(
    (latest, session) => (!latest || session.startedAt > latest ? session.startedAt : latest),
    null,
  )
  return {
    totalMs,
    sessionCount: started.length,
    averageMs: started.length > 0 ? totalMs / started.length : 0,
    lastSessionAt,
    projectsMs: totalMs - standaloneMs,
    standaloneMs,
  }
}
