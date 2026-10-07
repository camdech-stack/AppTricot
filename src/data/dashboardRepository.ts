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
import { computeProjectTimeStats, getSessionDuration, localDayKey, type TimeStats } from './timeStats'
import { computeYarnStockSummary } from './yarnMath'
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
