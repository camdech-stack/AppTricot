import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject, updateProject } from './projectsRepository'
import { applyCounterDelta, getCounters, getOrCreateStandaloneCounter } from './countersRepository'
import { createGuide, linkGuideToProject, saveGuideContent } from './guidesRepository'
import { advanceGuide, getLastUsedGuideId, startGuide } from './guideProgressRepository'
import { createYarn, addYarnUsage, computeGlobalYarnStats } from './yarnsRepository'
import { importPattern, linkPatternToProject } from './patternsRepository'
import { addBlock, addPiece, addRow, addSection } from './guideTree'
import { emptyGuideContent, type GuideContent } from './guideModel'
import { resetForegroundState } from './sessionTrackingState'
import { computeProjectProgress } from './progress'
import { computeProjectTimeStats } from './timeStats'
import { addManualSession, getSessionsForTarget, stopSession } from './sessionsRepository'
import {
  STANDALONE_COUNTER_LABEL,
  computeGlobalDashboardStats,
  getActiveProjectsSummary,
  getCompletedProjectsHistory,
  getContinueTarget,
  getHomeDashboard,
  getRecentSessions,
  getStatsOverview,
} from './dashboardRepository'

beforeEach(async () => {
  await db.delete()
  await db.open()
  resetForegroundState()
})

function newProject(name: string, status: 'todo' | 'in_progress' | 'paused' | 'done' = 'in_progress') {
  return createProject({ name, craft: 'knitting', description: '', colorKey: 'prune', status })
}

async function createGuideWithRows(rowCount: number) {
  let content: GuideContent = emptyGuideContent()
  const piece = addPiece(content, { name: 'Dos' })
  content = piece.content
  const section = addSection(content, piece.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const block = addBlock(content, section.id, 'rows')
  content = block.content
  for (let i = 1; i <= rowCount; i++) {
    content = addRow(content, block.id, { number: i, instructions: `rang ${i}` }).content
  }
  const guide = await createGuide({ name: 'Pull test', craft: 'knitting' })
  await saveGuideContent(guide.id, content)
  return guide
}

describe('computeGlobalDashboardStats', () => {
  it('returns zeros on an empty database', async () => {
    const stats = await computeGlobalDashboardStats()
    expect(stats).toEqual({
      projectCount: 0,
      byStatus: { todo: 0, in_progress: 0, paused: 0, done: 0 },
      completedThisMonth: 0,
      patternCount: 0,
      guideCount: 0,
      yarnCount: 0,
      yarnInStockCount: 0,
    })
  })

  it('counts projects by status, patterns, guides and yarns in stock', async () => {
    await newProject('A', 'todo')
    await newProject('B', 'in_progress')
    await newProject('C', 'in_progress')
    await newProject('D', 'paused')
    const done = await newProject('E', 'done')
    await updateProject(done.id, { completedAt: '2024-05-10' })
    await importPattern({
      name: 'Pull',
      craft: 'knitting',
      fileName: 'p.pdf',
      fileHash: 'h',
      pageCount: 1,
      sizeBytes: 1,
      fileBlob: new Blob(['x']),
      coverBlob: new Blob(['c']),
    })
    await createGuide({ name: 'G', craft: 'knitting' })
    const full = await createYarn({ name: 'Plein', skeinCount: 2, gramsPerSkein: 50 })
    const empty = await createYarn({ name: 'Épuisé', skeinCount: 1, gramsPerSkein: 50 })
    await addYarnUsage({ yarnId: empty.id, projectId: null, value: 50, unit: 'g', usedAt: '2024-05-01' })
    void full

    const stats = await computeGlobalDashboardStats(new Date(2024, 4, 20).getTime())
    expect(stats.projectCount).toBe(5)
    expect(stats.byStatus).toEqual({ todo: 1, in_progress: 2, paused: 1, done: 1 })
    expect(stats.completedThisMonth).toBe(1)
    expect(stats.patternCount).toBe(1)
    expect(stats.guideCount).toBe(1)
    expect(stats.yarnCount).toBe(2)
    expect(stats.yarnInStockCount).toBe(1)

    const otherMonth = await computeGlobalDashboardStats(new Date(2024, 5, 20).getTime())
    expect(otherMonth.completedThisMonth).toBe(0)
  })
})

describe('computeGlobalYarnStats', () => {
  it('is zero without any usage', async () => {
    expect(await computeGlobalYarnStats()).toMatchObject({ totalGrams: 0, totalMeters: 0, yarnsUsedCount: 0 })
  })

  it('aggregates usages across projects and the unattached ones, filtered by range', async () => {
    const project = await newProject('A')
    const yarn = await createYarn({ name: 'Mérinos', skeinCount: 10, gramsPerSkein: 50, metersPerSkein: 100 })
    await addYarnUsage({ yarnId: yarn.id, projectId: project.id, value: 100, unit: 'g', usedAt: '2024-01-15' })
    await addYarnUsage({ yarnId: yarn.id, projectId: null, value: 1, unit: 'skein', usedAt: '2024-02-15' })

    const all = await computeGlobalYarnStats()
    expect(all.totalGrams).toBe(150)
    expect(all.totalMeters).toBe(300)
    expect(all.yarnsUsedCount).toBe(1)

    const january = await computeGlobalYarnStats({ from: new Date(2024, 0, 1), to: new Date(2024, 1, 1) })
    expect(january.totalGrams).toBe(100)
  })
})

describe('getRecentSessions', () => {
  it('is empty without sessions', async () => {
    expect(await getRecentSessions(5)).toEqual([])
  })

  it('lists project, guide and standalone sessions newest first with their names', async () => {
    const a = await newProject('Écharpe')
    const b = await newProject('Bonnet')
    const [counterA] = await getCounters(a.id)
    await applyCounterDelta(counterA!.id, 1)
    await stopSession('user_stop')
    const [counterB] = await getCounters(b.id)
    await applyCounterDelta(counterB!.id, 1)
    await stopSession('user_stop')
    const standalone = await getOrCreateStandaloneCounter()
    await applyCounterDelta(standalone.id, 1)

    const recent = await getRecentSessions(10)
    expect(recent.map((entry) => entry.projectName)).toEqual([STANDALONE_COUNTER_LABEL, 'Bonnet', 'Écharpe'])
    expect(recent[0]?.isOpen).toBe(true)
    expect(await getRecentSessions(2)).toHaveLength(2)
  })

  it('filters by project and by the standalone counter', async () => {
    const a = await newProject('Écharpe')
    const [counterA] = await getCounters(a.id)
    await applyCounterDelta(counterA!.id, 1)
    await stopSession('user_stop')
    const standalone = await getOrCreateStandaloneCounter()
    await applyCounterDelta(standalone.id, 1)

    expect((await getRecentSessions(10, { projectId: a.id })).map((entry) => entry.projectName)).toEqual(['Écharpe'])
    expect((await getRecentSessions(10, { projectId: null })).map((entry) => entry.projectName)).toEqual([
      STANDALONE_COUNTER_LABEL,
    ])
  })
})

describe('getActiveProjectsSummary', () => {
  it('is empty when no project is in progress', async () => {
    await newProject('Fini', 'done')
    await newProject('Plus tard', 'todo')
    expect(await getActiveProjectsSummary()).toEqual([])
  })

  it('assembles counter-based and guide-based projects, most recently active first', async () => {
    const withCounter = await newProject('Écharpe')
    const [counter] = await getCounters(withCounter.id)
    for (let i = 0; i < 3; i++) await applyCounterDelta(counter!.id, 1)

    const withGuide = await newProject('Pull')
    const guide = await createGuideWithRows(4)
    await linkGuideToProject(withGuide.id, guide.id)
    await startGuide(withGuide.id, guide.id)
    await advanceGuide(withGuide.id, guide.id, { type: 'next' })
    await newProject('Pause', 'paused')

    const summary = await getActiveProjectsSummary()
    expect(summary.map((entry) => entry.project.name)).toEqual(['Pull', 'Écharpe'])

    const [pull, scarf] = summary
    expect(pull!.resume.kind).toBe('guide')
    if (pull!.resume.kind === 'guide') {
      expect(pull!.resume.description?.pieceName).toBe('Dos')
      expect(pull!.resume.description?.rowIndexInBlock).toBe(2)
    }
    expect(pull!.continueTarget).toEqual({ guideId: guide.id, hasPatterns: false })

    expect(scarf!.resume).toEqual({ kind: 'counter', counterName: 'Rangs', value: 3 })
    expect(scarf!.continueTarget).toEqual({ guideId: null, hasPatterns: false })

    // Nothing recomputed: the same pure functions give the same answers.
    const sessions = await getSessionsForTarget({ projectId: withCounter.id })
    expect(scarf!.timeStats.totalMs).toBe(computeProjectTimeStats(sessions, Date.now(), null).totalMs)
    expect(scarf!.progress).toEqual(computeProjectProgress(await getCounters(withCounter.id), []))
    expect(pull!.progress.kind).toBe('percent')
  })

  it('falls back to the counter when a linked guide has no progress yet', async () => {
    const project = await newProject('Pull')
    const guide = await createGuideWithRows(2)
    await linkGuideToProject(project.id, guide.id)

    const [entry] = await getActiveProjectsSummary()
    expect(entry!.resume.kind).toBe('counter')
    expect(entry!.continueTarget.guideId).toBe(guide.id)
  })
})

describe('getContinueTarget / getLastUsedGuideId', () => {
  it('reports linked patterns and the most recently advanced guide', async () => {
    const project = await newProject('Pull')
    expect(await getContinueTarget(project.id)).toEqual({ guideId: null, hasPatterns: false })

    const pattern = await importPattern({
      name: 'Pull',
      craft: 'knitting',
      fileName: 'p.pdf',
      fileHash: 'h',
      pageCount: 1,
      sizeBytes: 1,
      fileBlob: new Blob(['x']),
      coverBlob: new Blob(['c']),
    })
    await linkPatternToProject(project.id, pattern.id)

    const first = await createGuideWithRows(2)
    const second = await createGuideWithRows(2)
    await linkGuideToProject(project.id, first.id)
    await linkGuideToProject(project.id, second.id)
    expect(await getLastUsedGuideId(project.id)).toBe(first.id)

    await startGuide(project.id, second.id)
    await advanceGuide(project.id, second.id, { type: 'next' })
    expect(await getLastUsedGuideId(project.id)).toBe(second.id)
    expect(await getContinueTarget(project.id)).toEqual({ guideId: second.id, hasPatterns: true })
  })
})

const at = (month: number, day: number, hour: number, minute = 0) => new Date(2024, month, day, hour, minute).toISOString()

describe('getStatsOverview', () => {
  it('returns empty zero-filled buckets with no data', async () => {
    const overview = await getStatsOverview('week', new Date(2024, 1, 7, 12).getTime())
    expect(overview.time.totalMs).toBe(0)
    expect(overview.timeBuckets).toHaveLength(7)
    expect(overview.timeBuckets.every((bucket) => bucket.ms === 0)).toBe(true)
    expect(overview.completedInRange).toBe(0)
    expect(overview.yarn.yarnsUsedCount).toBe(0)
  })

  it('splits data across two periods and keeps week/month/year/all consistent', async () => {
    const now = new Date(2024, 1, 7, 12).getTime() // Wed 2024-02-07
    const project = await newProject('Pull')
    await addManualSession({ projectId: project.id }, at(0, 31, 22), at(1, 1, 1)) // crosses Jan 31 -> Feb 1
    await addManualSession({ projectId: project.id }, at(1, 6, 9), at(1, 6, 10)) // Tue of this week
    await addManualSession({ projectId: null }, at(1, 7, 9), at(1, 7, 9, 30)) // standalone counter
    await updateProject(project.id, { status: 'done', completedAt: '2024-02-05' })
    const yarn = await createYarn({ name: 'Mérinos', skeinCount: 5, gramsPerSkein: 50 })
    await addYarnUsage({ yarnId: yarn.id, projectId: project.id, value: 100, unit: 'g', usedAt: '2024-01-20' })
    await addYarnUsage({ yarnId: yarn.id, projectId: project.id, value: 50, unit: 'g', usedAt: '2024-02-06' })

    const week = await getStatsOverview('week', now)
    expect(week.time.totalMs).toBe(60 * 60_000 + 30 * 60_000)
    expect(week.time.sessionCount).toBe(2)
    expect(week.completedInRange).toBe(1)
    expect(week.yarn.totalGrams).toBe(50)
    expect(week.timeBuckets.reduce((sum, bucket) => sum + bucket.ms, 0)).toBe(week.time.totalMs)

    const month = await getStatsOverview('month', now)
    expect(month.time.totalMs).toBe(60 * 60_000 + 60 * 60_000 + 30 * 60_000) // the 1 h after midnight counts in February
    expect(month.timeBuckets).toHaveLength(29)

    const all = await getStatsOverview('all', now)
    expect(all.time.totalMs).toBe(4 * 60 * 60_000 + 30 * 60_000)
    expect(all.window.range.from).toEqual(new Date(2024, 0, 1))
    expect(all.yarn.totalGrams).toBe(150)
    expect(all.dashboard.byStatus.done).toBe(1)

    // Same figure as the project page for that project.
    const projectStats = computeProjectTimeStats(await getSessionsForTarget({ projectId: project.id }), now, null)
    expect(all.time.projectsMs).toBe(projectStats.totalMs)

    const year = await getStatsOverview('year', now)
    expect(year.timeBuckets.map((bucket) => bucket.key)).toHaveLength(12)
    expect(year.completedBuckets.find((bucket) => bucket.key === '2024-02')?.count).toBe(1)
  })
})

describe('getHomeDashboard', () => {
  it('works on an empty database', async () => {
    const home = await getHomeDashboard()
    expect(home.active).toEqual([])
    expect(home.recentSessions).toEqual([])
    expect(home.weekTime.totalMs).toBe(0)
    expect(home.monthYarn.totalSkeins).toBe(0)
  })

  it('combines active projects, this week time and recent sessions', async () => {
    const now = new Date(2024, 1, 7, 12).getTime()
    const project = await newProject('Pull')
    await addManualSession({ projectId: project.id }, at(1, 6, 9), at(1, 6, 10))
    await addManualSession({ projectId: project.id }, at(0, 2, 9), at(0, 2, 10))
    const home = await getHomeDashboard(now)
    expect(home.active).toHaveLength(1)
    expect(home.weekTime.totalMs).toBe(60 * 60_000)
    expect(home.recentSessions).toHaveLength(2)
    expect(home.dashboard.byStatus.in_progress).toBe(1)
  })
})

describe('getCompletedProjectsHistory', () => {
  it('lists done projects newest completion first with their total time', async () => {
    const older = await newProject('Ancien', 'done')
    const newer = await newProject('Récent', 'done')
    await newProject('En cours')
    await updateProject(older.id, { completedAt: '2023-12-01' })
    await updateProject(newer.id, { completedAt: '2024-01-15' })
    await addManualSession({ projectId: newer.id }, at(0, 10, 9), at(0, 10, 11))

    const history = await getCompletedProjectsHistory()
    expect(history.map((entry) => entry.project.name)).toEqual(['Récent', 'Ancien'])
    expect(history[0]!.totalMs).toBe(2 * 60 * 60_000)
    expect(history[1]!.totalMs).toBe(0)
  })

  it('is empty without done projects', async () => {
    expect(await getCompletedProjectsHistory()).toEqual([])
  })
})
