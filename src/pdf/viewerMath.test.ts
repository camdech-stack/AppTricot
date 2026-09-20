import { describe, expect, it } from 'vitest'
import { MAX_CANVAS_PIXELS, MAX_DEVICE_PIXEL_RATIO, clampPage, clampZoom, computeRenderBudget } from './viewerMath'

describe('clampZoom', () => {
  it('keeps values within [1, 5]', () => {
    expect(clampZoom(0.5)).toBe(1)
    expect(clampZoom(3)).toBe(3)
    expect(clampZoom(8)).toBe(5)
  })

  it('falls back to the minimum for non-finite input', () => {
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('clampPage', () => {
  it('keeps values within [1, pageCount]', () => {
    expect(clampPage(0, 12)).toBe(1)
    expect(clampPage(5, 12)).toBe(5)
    expect(clampPage(99, 12)).toBe(12)
  })

  it('rounds fractional pages', () => {
    expect(clampPage(4.6, 12)).toBe(5)
  })

  it('treats a pageCount below 1 as a single page', () => {
    expect(clampPage(5, 0)).toBe(1)
  })
})

describe('computeRenderBudget', () => {
  it('renders at full resolution under the pixel budget', () => {
    const budget = computeRenderBudget(400, 600, 2)
    expect(budget.canvasWidth).toBe(800)
    expect(budget.canvasHeight).toBe(1200)
    expect(budget.canvasWidth * budget.canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
  })

  it('caps the device pixel ratio at 2 even when the screen reports more', () => {
    const cappedAt2 = computeRenderBudget(300, 300, 2)
    const cappedAt3 = computeRenderBudget(300, 300, 3)
    expect(cappedAt3).toEqual(cappedAt2)
  })

  it('scales down and preserves aspect ratio once the ideal size exceeds the pixel budget', () => {
    const budget = computeRenderBudget(3000, 4000, MAX_DEVICE_PIXEL_RATIO)
    expect(budget.canvasWidth * budget.canvasHeight).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    expect(budget.canvasWidth / budget.canvasHeight).toBeCloseTo(3000 / 4000, 2)
    // CSS size stays at the requested logical size — the browser scales the
    // smaller canvas up to fill it.
    expect(budget.cssWidth).toBe(3000)
    expect(budget.cssHeight).toBe(4000)
  })
})
