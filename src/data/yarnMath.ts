import type { ProjectStatus, YarnQuantityUnitValue, YarnRecord } from './types'

export const METERS_PER_YARD = 0.9144

export function yardsToMeters(yards: number): number {
  return yards * METERS_PER_YARD
}

export function metersToYards(meters: number): number {
  return meters / METERS_PER_YARD
}

// Converts a quantity (grams or meters) to skeins using the yarn's own
// per-skein figures. Returns null when that conversion is impossible (the
// relevant per-skein figure is missing).
export function toSkeins(amount: number, unit: 'g' | 'm', yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>): number | null {
  if (unit === 'g') {
    if (!yarn.gramsPerSkein) return null
    return amount / yarn.gramsPerSkein
  }
  if (!yarn.metersPerSkein) return null
  return amount / yarn.metersPerSkein
}

// Converts a quantity of skeins to grams or meters. Returns null when the
// yarn has no corresponding per-skein figure.
export function fromSkeins(skeins: number, unit: 'g' | 'm', yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>): number | null {
  if (unit === 'g') {
    if (!yarn.gramsPerSkein) return null
    return skeins * yarn.gramsPerSkein
  }
  if (!yarn.metersPerSkein) return null
  return skeins * yarn.metersPerSkein
}

// Converts any usage/planned amount (g, m or skein) to skeins for the yarn.
export function amountToSkeins(
  value: number,
  unit: YarnQuantityUnitValue,
  yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>,
): number | null {
  if (unit === 'skein') return value
  return toSkeins(value, unit, yarn)
}

// Converts a skein amount back to the requested unit.
export function skeinsToAmount(
  skeins: number,
  unit: YarnQuantityUnitValue,
  yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>,
): number | null {
  if (unit === 'skein') return skeins
  return fromSkeins(skeins, unit, yarn)
}

export interface UsageLike {
  yarnId: string
  projectId: string | null
  value: number
  unit: YarnQuantityUnitValue
}

export interface ProjectYarnLike {
  projectId: string
  yarnId: string
  plannedValue: number
  plannedUnit: YarnQuantityUnitValue
}

export interface ProjectLike {
  id: string
  status: ProjectStatus
}

const RESERVING_STATUSES: ProjectStatus[] = ['todo', 'in_progress', 'paused']

function reservesStock(status: ProjectStatus | undefined): boolean {
  return status !== undefined && RESERVING_STATUSES.includes(status)
}

// Sums a list of usages for a given yarn (any project, including null) into
// skeins. A usage whose conversion is impossible is skipped (treated as 0)
// rather than making the whole total unknown.
function sumUsagesInSkeins(usages: UsageLike[], yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>): number {
  return usages.reduce((sum, usage) => {
    const skeins = amountToSkeins(usage.value, usage.unit, yarn)
    return sum + (skeins ?? 0)
  }, 0)
}

export interface YarnStockSummary {
  initialSkeins: number
  consumedSkeins: number
  // null when stock is exceeded — display "stock dépassé" instead.
  remainingSkeins: number | null
  reservedSkeins: number
  // null when remaining is itself null (stock exceeded).
  availableSkeins: number | null
  consumedRatio: number | null
}

// Core stock computation for one yarn, in skeins throughout — everything
// else (conversion to a display unit) happens at the UI edge.
export function computeYarnStockSummary(
  yarn: Pick<YarnRecord, 'id' | 'skeinCount' | 'gramsPerSkein' | 'metersPerSkein'>,
  usages: UsageLike[],
  projectYarns: ProjectYarnLike[],
  projects: ProjectLike[],
): YarnStockSummary {
  const yarnUsages = usages.filter((usage) => usage.yarnId === yarn.id)
  const initialSkeins = yarn.skeinCount
  const consumedSkeins = sumUsagesInSkeins(yarnUsages, yarn)
  const rawRemaining = initialSkeins - consumedSkeins
  const remainingSkeins = rawRemaining < 0 ? null : rawRemaining

  const projectStatusById = new Map(projects.map((project) => [project.id, project.status]))
  const reservedSkeins = projectYarns
    .filter((link) => link.yarnId === yarn.id && reservesStock(projectStatusById.get(link.projectId)))
    .reduce((sum, link) => {
      const plannedSkeins = amountToSkeins(link.plannedValue, link.plannedUnit, yarn) ?? 0
      const consumedByProjectSkeins = sumUsagesInSkeins(
        yarnUsages.filter((usage) => usage.projectId === link.projectId),
        yarn,
      )
      return sum + Math.max(plannedSkeins - consumedByProjectSkeins, 0)
    }, 0)

  const availableSkeins = remainingSkeins === null ? null : remainingSkeins - reservedSkeins
  const consumedRatio = initialSkeins > 0 ? consumedSkeins / initialSkeins : null

  return { initialSkeins, consumedSkeins, remainingSkeins, reservedSkeins, availableSkeins, consumedRatio }
}

export interface ProjectYarnAvailability {
  status: 'ok' | 'missing' | 'unknown'
  // Missing amount, expressed in the need's own unit (only set when status === 'missing').
  missingValue: number | null
  missingUnit: YarnQuantityUnitValue | null
}

// Availability check for one project/yarn link: need = planned - already
// consumed by this project; stock = remaining - reserved by OTHER projects.
export function checkProjectYarnAvailability(
  link: ProjectYarnLike,
  yarn: Pick<YarnRecord, 'id' | 'skeinCount' | 'gramsPerSkein' | 'metersPerSkein'>,
  usages: UsageLike[],
  projectYarns: ProjectYarnLike[],
  projects: ProjectLike[],
): ProjectYarnAvailability {
  const plannedSkeins = amountToSkeins(link.plannedValue, link.plannedUnit, yarn)
  const yarnUsages = usages.filter((usage) => usage.yarnId === yarn.id)
  const consumedByProjectSkeins = sumUsagesInSkeins(
    yarnUsages.filter((usage) => usage.projectId === link.projectId),
    yarn,
  )

  if (plannedSkeins === null) {
    return { status: 'unknown', missingValue: null, missingUnit: null }
  }

  const needSkeins = Math.max(plannedSkeins - consumedByProjectSkeins, 0)

  const summary = computeYarnStockSummary(yarn, usages, projectYarns, projects)
  if (summary.remainingSkeins === null) {
    // Stock already exceeded overall: nothing left for anyone.
    const missingValue = skeinsToAmount(needSkeins, link.plannedUnit, yarn)
    return { status: needSkeins > 0 ? 'missing' : 'ok', missingValue, missingUnit: link.plannedUnit }
  }

  const reservedByOthersSkeins = projectYarns
    .filter(
      (other) =>
        other.yarnId === yarn.id &&
        other.projectId !== link.projectId &&
        reservesStock(projects.find((project) => project.id === other.projectId)?.status),
    )
    .reduce((sum, other) => {
      const plannedOtherSkeins = amountToSkeins(other.plannedValue, other.plannedUnit, yarn) ?? 0
      const consumedOtherSkeins = sumUsagesInSkeins(
        yarnUsages.filter((usage) => usage.projectId === other.projectId),
        yarn,
      )
      return sum + Math.max(plannedOtherSkeins - consumedOtherSkeins, 0)
    }, 0)

  const stockSkeins = summary.remainingSkeins - reservedByOthersSkeins
  const missingSkeins = needSkeins - stockSkeins

  if (missingSkeins <= 0) {
    return { status: 'ok', missingValue: null, missingUnit: null }
  }

  const missingValue = skeinsToAmount(missingSkeins, link.plannedUnit, yarn)
  if (missingValue === null) {
    return { status: 'unknown', missingValue: null, missingUnit: null }
  }
  return { status: 'missing', missingValue, missingUnit: link.plannedUnit }
}

export interface ProjectYarnLinkProgress {
  plannedSkeins: number | null
  consumedSkeins: number
  ratio: number | null
}

export function computeProjectYarnLinkProgress(
  link: ProjectYarnLike,
  yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>,
  usages: UsageLike[],
): ProjectYarnLinkProgress {
  const plannedSkeins = amountToSkeins(link.plannedValue, link.plannedUnit, yarn)
  const consumedSkeins = sumUsagesInSkeins(
    usages.filter((usage) => usage.yarnId === link.yarnId && usage.projectId === link.projectId),
    yarn,
  )
  const ratio = plannedSkeins && plannedSkeins > 0 ? consumedSkeins / plannedSkeins : null
  return { plannedSkeins, consumedSkeins, ratio }
}
