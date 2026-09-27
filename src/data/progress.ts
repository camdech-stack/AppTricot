// Pure, isolated so it's easy to test independently of the counters/
// projects/guides repositories.
export interface ProgressCounterInput {
  value: number
  goal: number | null
  isMain: boolean
}

// One linked guide's step progress (see guideProgress.ts's
// getGuideProgress) — a plain pure-data shape, never a DB read, so this
// file stays a pure function like the rest of it.
export interface ProgressGuideInput {
  knownSteps: number
  doneSteps: number
}

export interface ProjectProgressPercent {
  kind: 'percent'
  ratio: number // 0 to 1
}

export interface ProjectProgressCount {
  kind: 'count'
  rows: number
}

export type ProjectProgress = ProjectProgressPercent | ProjectProgressCount

function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

// Step 5b: once a project has at least one linked guide with at least one
// known step, its progress becomes "steps done / steps known" summed
// across every linked guide — the counter-based calculation below is only
// a fallback for projects with no (usable) guide. `guides` defaults to an
// empty array so every pre-5b call site keeps compiling and behaving
// exactly as before.
export function computeProjectProgress(counters: ProgressCounterInput[], guides: ProgressGuideInput[] = []): ProjectProgress {
  const totalKnownSteps = guides.reduce((sum, guide) => sum + guide.knownSteps, 0)
  if (totalKnownSteps > 0) {
    const totalDoneSteps = guides.reduce((sum, guide) => sum + guide.doneSteps, 0)
    return { kind: 'percent', ratio: clampRatio(totalDoneSteps / totalKnownSteps) }
  }

  const mainCounter = counters.find((counter) => counter.isMain)

  if (mainCounter?.goal) {
    return { kind: 'percent', ratio: clampRatio(mainCounter.value / mainCounter.goal) }
  }

  const withGoal = counters.filter((counter): counter is ProgressCounterInput & { goal: number } =>
    Boolean(counter.goal && counter.goal > 0),
  )
  if (withGoal.length > 0) {
    const average = withGoal.reduce((sum, counter) => sum + clampRatio(counter.value / counter.goal), 0) / withGoal.length
    return { kind: 'percent', ratio: average }
  }

  return { kind: 'count', rows: mainCounter?.value ?? 0 }
}
