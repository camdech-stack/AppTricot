// Read-only aggregation for the home screen and the stats tab (step 6).
// Nothing here computes progress, time or yarn math itself: every number
// comes from the existing pure functions (progress.ts, timeStats.ts,
// yarnMath.ts) and repositories — this file only gathers inputs and
// assembles the result.
import { db } from './db'
import { getCounters } from './countersRepository'
import { getLastUsedGuideId, getProjectGuideProgressInputs, getProjectResumeSummary } from './guideProgressRepository'
import { getSessionsForTarget } from './sessionsRepository'
import { getLiveSessionId } from './sessionTrackingState'
import { computeProjectProgress, type ProjectProgress } from './progress'
import {
  aggregateTimeByPeriod,
  computeGlobalTimeStatsInRange,
  computeProjectTimeStats,
  countCompletedProjectsByPeriod,
  getSessionDuration,
  getStatsWindow,
  listBucketKeys,
  localDayKey,
  type CompletedBucket,
  type GlobalTimeStats,
  type StatsView,
  type StatsWindow,
  type TimeBucket,
  type TimeStats,
} from './timeStats'
import { computeYarnStockSummary, type YarnConsumptionStats } from './yarnMath'
import { computeGlobalYarnStats } from './yarnsRepository'
import type { CursorDescription } from './guideProgress'
import type { ProjectRecord, ProjectStatus, SessionRecord } from './types'

// Same label as the home "Outils" tile and the standalone counter screen.
export const STANDALONE_COUNTER_LABEL = 'Compteur de rang'

export interface GlobalDashboardStats {
  projectCount: number
  byStatus: Record<ProjectStatus, number>
  completedThisMonth: number
  patternCount: number
  guideCount: number
  yarnCount: number
  // Yarns with at least some stock left once consumption is deducted.
  yarnInStockCount: number
}

export async function computeGlobalDashboardStats(now: number = Date.now()): Promise<GlobalDashboardStats> {
  const [projects, patternCount, guideCount, yarns, usages] = await Promise.all([
    db.projects.toArray(),
    db.patterns.count(),
    db.guides.count(),
    db.yarns.toArray(),
    db.yarnUsages.toArray(),
  ])

  const byStatus: Record<ProjectStatus, number> = { todo: 0, in_progress: 0, paused: 0, done: 0 }
  for (const project of projects) byStatus[project.status] += 1

  const monthPrefix = localDayKey(new Date(now)).slice(0, 7)
  const completedThisMonth = projects.filter((project) => project.completedAt?.startsWith(monthPrefix)).length

  const yarnInStockCount = yarns.filter((yarn) => {
    const { remainingSkeins } = computeYarnStockSummary(yarn, usages, [], [])
    return remainingSkeins !== null && remainingSkeins > 0
  }).length

  return {
    projectCount: projects.length,
    byStatus,
    completedThisMonth,
    patternCount,
    guideCount,
    yarnCount: yarns.length,
    yarnInStockCount,
  }
}

export interface RecentSession {
  session: SessionRecord
  projectId: string | null
  // The project's name, or STANDALONE_COUNTER_LABEL for the standalone counter.
  projectName: string
  durationMs: number
  isOpen: boolean
}

export interface RecentSessionsFilter {
  // A project id, `null` for the standalone counter, omitted for everything.
  projectId?: string | null
}

export async function getRecentSessions(
  limit: number,
  filter: RecentSessionsFilter = {},
  now: number = Date.now(),
): Promise<RecentSession[]> {
  const sessions = await db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((session) => filter.projectId === undefined || session.projectId === filter.projectId)
    .limit(limit)
    .toArray()

  const projectIds = [...new Set(sessions.flatMap((session) => (session.projectId ? [session.projectId] : [])))]
  const projects = await db.projects.bulkGet(projectIds)
  const nameById = new Map(projects.flatMap((project) => (project ? [[project.id, project.name] as const] : [])))
  const liveId = getLiveSessionId()

  return sessions.map((session) => ({
    session,
    projectId: session.projectId,
    projectName: session.projectId ? (nameById.get(session.projectId) ?? 'Projet supprimé') : STANDALONE_COUNTER_LABEL,
    durationMs: getSessionDuration(session, now, liveId),
    isOpen: session.endedAt === null,
  }))
}

export interface ContinueTarget {
  // The guide "Continuer"/"Reprendre" opens, null if none is linked.
  guideId: string | null
  hasPatterns: boolean
}

export async function getContinueTarget(projectId: string): Promise<ContinueTarget> {
  const [guideId, patternLinkCount] = await Promise.all([
    getLastUsedGuideId(projectId),
    db.projectPatterns.where('projectId').equals(projectId).count(),
  ])
  return { guideId, hasPatterns: patternLinkCount > 0 }
}

export type ActiveProjectResume =
  | {
      kind: 'guide'
      guideId: string
      description: CursorDescription | null
      percent: number
    }
  | { kind: 'counter'; counterName: string; value: number }
  | { kind: 'none' }

export interface ActiveProjectSummary {
  project: ProjectRecord
  progress: ProjectProgress
  resume: ActiveProjectResume
  timeStats: TimeStats
  lastActivityAt: string
  continueTarget: ContinueTarget
}

// Quick-resume data for every "En cours" project, most recently active
// first. A guide with recorded progress gives the exact resume point;
// otherwise the project's active counter does.
export async function getActiveProjectsSummary(now: number = Date.now()): Promise<ActiveProjectSummary[]> {
  const projects = (await db.projects.where('status').equals('in_progress').toArray()).sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  )
  const liveId = getLiveSessionId()

  return Promise.all(
    projects.map(async (project): Promise<ActiveProjectSummary> => {
      const [counters, guideInputs, guideResume, sessions, continueTarget] = await Promise.all([
        getCounters(project.id),
        getProjectGuideProgressInputs(project.id),
        getProjectResumeSummary(project.id),
        getSessionsForTarget({ projectId: project.id }),
        getContinueTarget(project.id),
      ])

      let resume: ActiveProjectResume = { kind: 'none' }
      if (guideResume) {
        resume = {
          kind: 'guide',
          guideId: guideResume.guideId,
          description: guideResume.description,
          percent: guideResume.percent,
        }
      } else {
        const counter = counters.find((candidate) => candidate.id === project.activeCounterId) ?? counters.find((candidate) => candidate.isMain)
        if (counter) resume = { kind: 'counter', counterName: counter.name, value: counter.value }
      }

      return {
        project,
        progress: computeProjectProgress(counters, guideInputs),
        resume,
        timeStats: computeProjectTimeStats(sessions, now, liveId),
        lastActivityAt: project.lastActivityAt,
        continueTarget,
      }
    }),
  )
}

const HOME_RECENT_SESSIONS_COUNT = 4

export interface HomeDashboard {
  active: ActiveProjectSummary[]
  dashboard: GlobalDashboardStats
  weekTime: GlobalTimeStats
  monthYarn: YarnConsumptionStats
  recentSessions: RecentSession[]
}

// Everything the home screen shows, gathered in one read so a single live
// query (and a single re-render) covers it.
export async function getHomeDashboard(now: number = Date.now()): Promise<HomeDashboard> {
  const nowDate = new Date(now)
  const week = getStatsWindow('week', nowDate).range
  const month = getStatsWindow('month', nowDate).range

  const [active, dashboard, sessions, monthYarn, recentSessions] = await Promise.all([
    getActiveProjectsSummary(now),
    computeGlobalDashboardStats(now),
    db.sessions.toArray(),
    computeGlobalYarnStats(month),
    getRecentSessions(HOME_RECENT_SESSIONS_COUNT, {}, now),
  ])

  return {
    active,
    dashboard,
    weekTime: computeGlobalTimeStatsInRange(sessions, week, now, getLiveSessionId()),
    monthYarn,
    recentSessions,
  }
}

export interface StatsOverview {
  view: StatsView
  window: StatsWindow
  dashboard: GlobalDashboardStats
  time: GlobalTimeStats
  // One entry per bucket of the window, empty periods included.
  timeBuckets: TimeBucket[]
  completedBuckets: CompletedBucket[]
  completedInRange: number
  yarn: YarnConsumptionStats
}

// The stats tab's data for one period view.
export async function getStatsOverview(view: StatsView, now: number = Date.now()): Promise<StatsOverview> {
  const [sessions, projects, usages, dashboard] = await Promise.all([
    db.sessions.toArray(),
    db.projects.toArray(),
    db.yarnUsages.toArray(),
    computeGlobalDashboardStats(now),
  ])

  const earliestCandidates = [
    ...sessions.map((session) => new Date(session.startedAt).getTime()),
    ...projects.flatMap((project) => (project.completedAt ? [new Date(`${project.completedAt}T00:00:00`).getTime()] : [])),
    ...usages.map((usage) => new Date(`${usage.usedAt}T00:00:00`).getTime()),
  ].filter((ms) => Number.isFinite(ms))
  const earliestMs = earliestCandidates.length > 0 ? Math.min(...earliestCandidates) : null

  const window = getStatsWindow(view, new Date(now), earliestMs)
  const { range, period } = window
  const liveId = getLiveSessionId()

  const timeByKey = new Map(aggregateTimeByPeriod(sessions, period, range, now, liveId).map((bucket) => [bucket.key, bucket.ms]))
  const completedByKey = new Map(
    countCompletedProjectsByPeriod(projects, period, range).map((bucket) => [bucket.key, bucket.count]),
  )
  const keys = listBucketKeys(period, range)

  const completedBuckets = keys.map((key) => ({ key, count: completedByKey.get(key) ?? 0 }))

  return {
    view,
    window,
    dashboard,
    time: computeGlobalTimeStatsInRange(sessions, range, now, liveId),
    timeBuckets: keys.map((key) => ({ key, ms: timeByKey.get(key) ?? 0 })),
    completedBuckets,
    completedInRange: completedBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
    yarn: await computeGlobalYarnStats(range),
  }
}

export interface CompletedProjectEntry {
  project: ProjectRecord
  totalMs: number
}

// Every finished project with its total time (same computeProjectTimeStats
// as the project page), newest completion first.
export async function getCompletedProjectsHistory(now: number = Date.now()): Promise<CompletedProjectEntry[]> {
  const projects = (await db.projects.where('status').equals('done').toArray()).sort((a, b) =>
    (b.completedAt ?? b.updatedAt.slice(0, 10)).localeCompare(a.completedAt ?? a.updatedAt.slice(0, 10)),
  )
  const liveId = getLiveSessionId()
  return Promise.all(
    projects.map(async (project) => ({
      project,
      totalMs: computeProjectTimeStats(await getSessionsForTarget({ projectId: project.id }), now, liveId).totalMs,
    })),
  )
}
