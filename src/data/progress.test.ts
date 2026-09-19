import { describe, expect, it } from 'vitest'
import { computeProjectProgress } from './progress'

describe('computeProjectProgress', () => {
  it('uses the main counter ratio when it has a goal', () => {
    const result = computeProjectProgress([
      { value: 30, goal: 60, isMain: true },
      { value: 5, goal: null, isMain: false },
    ])
    expect(result).toEqual({ kind: 'percent', ratio: 0.5 })
  })

  it('averages counters with a goal when the main counter has none', () => {
    const result = computeProjectProgress([
      { value: 10, goal: null, isMain: true },
      { value: 5, goal: 10, isMain: false },
      { value: 15, goal: 30, isMain: false },
    ])
    expect(result).toEqual({ kind: 'percent', ratio: 0.5 })
  })

  it('falls back to the main counter row count when nothing has a goal', () => {
    const result = computeProjectProgress([{ value: 12, goal: null, isMain: true }])
    expect(result).toEqual({ kind: 'count', rows: 12 })
  })

  it('caps the ratio at 100%', () => {
    const result = computeProjectProgress([{ value: 120, goal: 60, isMain: true }])
    expect(result).toEqual({ kind: 'percent', ratio: 1 })
  })

  it('returns zero rows for an empty project', () => {
    const result = computeProjectProgress([])
    expect(result).toEqual({ kind: 'count', rows: 0 })
  })
})
