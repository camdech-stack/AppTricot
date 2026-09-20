import { describe, expect, it } from 'vitest'
import {
  checkProjectYarnAvailability,
  computeProjectYarnLinkProgress,
  computeYarnStockSummary,
  fromSkeins,
  metersToYards,
  toSkeins,
  yardsToMeters,
} from './yarnMath'

const YARN_50G_192M = { id: 'yarn-1', skeinCount: 5, gramsPerSkein: 50, metersPerSkein: 192 }
const YARN_NO_FIGURES = { id: 'yarn-2', skeinCount: 3, gramsPerSkein: null, metersPerSkein: null }

describe('unit conversions', () => {
  it('converts yards to meters and back', () => {
    expect(yardsToMeters(100)).toBeCloseTo(91.44)
    expect(metersToYards(91.44)).toBeCloseTo(100)
  })

  it('converts grams and meters to skeins', () => {
    expect(toSkeins(100, 'g', YARN_50G_192M)).toBe(2)
    expect(toSkeins(96, 'm', YARN_50G_192M)).toBe(0.5)
  })

  it('converts skeins back to grams and meters', () => {
    expect(fromSkeins(2, 'g', YARN_50G_192M)).toBe(100)
    expect(fromSkeins(0.5, 'm', YARN_50G_192M)).toBe(96)
  })

  it('returns null when the per-skein figure is missing', () => {
    expect(toSkeins(100, 'g', YARN_NO_FIGURES)).toBeNull()
    expect(toSkeins(100, 'm', YARN_NO_FIGURES)).toBeNull()
    expect(fromSkeins(2, 'g', YARN_NO_FIGURES)).toBeNull()
  })
})

describe('computeYarnStockSummary', () => {
  it('computes initial, consumed, remaining, reserved and available', () => {
    const summary = computeYarnStockSummary(
      YARN_50G_192M,
      [{ yarnId: 'yarn-1', projectId: 'p1', value: 100, unit: 'g' }],
      [{ projectId: 'p1', yarnId: 'yarn-1', plannedValue: 200, plannedUnit: 'g' }],
      [{ id: 'p1', status: 'in_progress' }],
    )
    // 5 skeins = 250g initial, consumed 100g = 2 skeins, remaining 3 skeins.
    expect(summary.initialSkeins).toBe(5)
    expect(summary.consumedSkeins).toBe(2)
    expect(summary.remainingSkeins).toBe(3)
    // Reserved = planned(200g=4 skeins) - consumed by p1 (100g=2 skeins) = 2 skeins.
    expect(summary.reservedSkeins).toBe(2)
    expect(summary.availableSkeins).toBe(1)
    expect(summary.consumedRatio).toBeCloseTo(0.4)
  })

  it('reports stock exceeded as null remaining/available instead of negative', () => {
    const summary = computeYarnStockSummary(
      YARN_50G_192M,
      [{ yarnId: 'yarn-1', projectId: null, value: 300, unit: 'g' }],
      [],
      [],
    )
    expect(summary.remainingSkeins).toBeNull()
    expect(summary.availableSkeins).toBeNull()
  })

  it('does not reserve stock for a done project', () => {
    const summary = computeYarnStockSummary(
      YARN_50G_192M,
      [],
      [{ projectId: 'p1', yarnId: 'yarn-1', plannedValue: 200, plannedUnit: 'g' }],
      [{ id: 'p1', status: 'done' }],
    )
    expect(summary.reservedSkeins).toBe(0)
  })

  it('reserves stock for two projects on the same yarn', () => {
    const summary = computeYarnStockSummary(
      YARN_50G_192M,
      [],
      [
        { projectId: 'p1', yarnId: 'yarn-1', plannedValue: 100, plannedUnit: 'g' },
        { projectId: 'p2', yarnId: 'yarn-1', plannedValue: 50, plannedUnit: 'g' },
      ],
      [
        { id: 'p1', status: 'in_progress' },
        { id: 'p2', status: 'todo' },
      ],
    )
    // 100g + 50g = 150g = 3 skeins reserved.
    expect(summary.reservedSkeins).toBe(3)
  })
})

describe('checkProjectYarnAvailability', () => {
  it('reports sufficient stock: need 600g, stock 750g', () => {
    const yarn = { id: 'yarn-1', skeinCount: 15, gramsPerSkein: 50, metersPerSkein: null } // 750g total
    const result = checkProjectYarnAvailability(
      { projectId: 'p1', yarnId: 'yarn-1', plannedValue: 600, plannedUnit: 'g' },
      yarn,
      [],
      [{ projectId: 'p1', yarnId: 'yarn-1', plannedValue: 600, plannedUnit: 'g' }],
      [{ id: 'p1', status: 'in_progress' }],
    )
    expect(result.status).toBe('ok')
  })

  it('reports 150g missing: need 800g, stock 650g', () => {
    const yarn = { id: 'yarn-1', skeinCount: 13, gramsPerSkein: 50, metersPerSkein: null } // 650g total
    const result = checkProjectYarnAvailability(
      { projectId: 'p1', yarnId: 'yarn-1', plannedValue: 800, plannedUnit: 'g' },
      yarn,
      [],
      [{ projectId: 'p1', yarnId: 'yarn-1', plannedValue: 800, plannedUnit: 'g' }],
      [{ id: 'p1', status: 'in_progress' }],
    )
    expect(result.status).toBe('missing')
    expect(result.missingValue).toBeCloseTo(150)
    expect(result.missingUnit).toBe('g')
  })

  it('excludes stock reserved by other active projects', () => {
    const yarn = { id: 'yarn-1', skeinCount: 20, gramsPerSkein: 50, metersPerSkein: null } // 1000g total
    const links = [
      { projectId: 'p1', yarnId: 'yarn-1', plannedValue: 600, plannedUnit: 'g' as const },
      { projectId: 'p2', yarnId: 'yarn-1', plannedValue: 500, plannedUnit: 'g' as const },
    ]
    const result = checkProjectYarnAvailability(links[0]!, yarn, [], links, [
      { id: 'p1', status: 'in_progress' },
      { id: 'p2', status: 'in_progress' },
    ])
    // Stock 1000g - reserved by p2 (500g) = 500g available, need 600g -> 100g missing.
    expect(result.status).toBe('missing')
    expect(result.missingValue).toBeCloseTo(100)
  })

  it('returns unknown when the conversion is impossible', () => {
    const result = checkProjectYarnAvailability(
      { projectId: 'p1', yarnId: 'yarn-2', plannedValue: 100, plannedUnit: 'g' },
      YARN_NO_FIGURES,
      [],
      [],
      [{ id: 'p1', status: 'in_progress' }],
    )
    expect(result.status).toBe('unknown')
  })
})

describe('computeProjectYarnLinkProgress', () => {
  it('computes the consumed ratio for a project/yarn link', () => {
    const progress = computeProjectYarnLinkProgress(
      { projectId: 'p1', yarnId: 'yarn-1', plannedValue: 200, plannedUnit: 'g' },
      YARN_50G_192M,
      [{ yarnId: 'yarn-1', projectId: 'p1', value: 100, unit: 'g' }],
    )
    expect(progress.ratio).toBeCloseTo(0.5)
  })
})
