// Pure helpers behind the viewer's zoom/page bounds and memory budget — the
// gestures and actual canvas rendering that use them aren't unit-tested
// (see CLAUDE.md "les gestes et le rendu ne se testent pas en automatique"),
// but these rules are.

// Zoom is a multiplier relative to "fit width" (1x = fit, per CLAUDE.md
// "Zoom : ajusté à la largeur par défaut, de 1x à 5x").
export const MIN_ZOOM = 1
export const MAX_ZOOM = 5
export const DOUBLE_TAP_ZOOM = 2

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function clampPage(page: number, pageCount: number): number {
  const lastPage = Math.max(1, Math.floor(pageCount))
  if (!Number.isFinite(page)) return 1
  return Math.min(lastPage, Math.max(1, Math.round(page)))
}

// iOS Safari kills the tab past a certain canvas pixel count — cap the
// render resolution and the effective device pixel ratio (see CLAUDE.md
// "Limite mémoire iOS"); beyond the cap, the canvas renders smaller and is
// scaled up via CSS instead of growing further.
export const MAX_CANVAS_PIXELS = 12_000_000
export const MAX_DEVICE_PIXEL_RATIO = 2

export interface RenderBudget {
  canvasWidth: number
  canvasHeight: number
  cssWidth: number
  cssHeight: number
}

export function computeRenderBudget(cssWidth: number, cssHeight: number, devicePixelRatio: number): RenderBudget {
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, devicePixelRatio))
  const idealWidth = cssWidth * dpr
  const idealHeight = cssHeight * dpr
  const idealPixels = idealWidth * idealHeight

  if (idealPixels === 0 || idealPixels <= MAX_CANVAS_PIXELS) {
    return { canvasWidth: Math.round(idealWidth), canvasHeight: Math.round(idealHeight), cssWidth, cssHeight }
  }

  const scale = Math.sqrt(MAX_CANVAS_PIXELS / idealPixels)
  return {
    canvasWidth: Math.round(idealWidth * scale),
    canvasHeight: Math.round(idealHeight * scale),
    cssWidth,
    cssHeight,
  }
}

// Ignores a horizontal swipe that starts within this many px of the screen
// edge — iOS system back/app-switch gestures live there (see CLAUDE.md
// "Page suivante ou précédente par glissement").
export const EDGE_SWIPE_GUARD_PX = 24
