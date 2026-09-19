// Pure, isolated so it's easy to test and to swap out later for guide-based
// progress (step 5b) without touching the counters/projects repositories.
export interface ProgressCounterInput {
  value: number
  goal: number | null
  isMain: boolean
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

export function computeProjectProgress(counters: ProgressCounterInput[]): ProjectProgress {
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
