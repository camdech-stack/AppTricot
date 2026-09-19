import { describe, expect, it } from 'vitest'
import { daysBetween, daysSince, daysUntil } from './dateDiff'

describe('daysBetween', () => {
  it('counts whole days between two calendar dates', () => {
    expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9)
  })

  it('returns 0 for the same date', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0)
  })

  it('returns a negative value when the target date is earlier', () => {
    expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9)
  })
})

describe('daysSince / daysUntil', () => {
  it('daysSince is days elapsed from a past date to today', () => {
    expect(daysSince('2024-01-01', '2024-01-15')).toBe(14)
  })

  it('daysUntil is days remaining from today to a future date', () => {
    expect(daysUntil('2024-02-01', '2024-01-15')).toBe(17)
  })
})
