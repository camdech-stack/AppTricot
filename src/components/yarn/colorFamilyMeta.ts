import type { YarnColorFamily } from '../../data'
import { COLOR_FAMILY_OPTIONS } from './yarnMeta'

export function yarnColorFamilyVar(family: YarnColorFamily | null): string {
  // No color family picked: a neutral border, same tone as every other
  // unaccented card border in the app.
  if (!family) return 'var(--color-border)'
  return `var(--color-yarn-${family})`
}

export function yarnColorFamilySoftVar(family: YarnColorFamily | null): string {
  if (!family) return 'var(--color-surface-alt)'
  return `var(--color-yarn-${family}-soft)`
}

// "Multicolore" can't be a single hue: borders it with a gradient sweeping
// across every other named color family instead.
const MULTICOLORE_GRADIENT = `linear-gradient(90deg, ${COLOR_FAMILY_OPTIONS.filter(
  (family) => family !== 'multicolore',
)
  .map((family) => `var(--color-yarn-${family})`)
  .join(', ')})`

// For a plain color family, a border-color is enough. "Multicolore" needs a
// gradient, but `border-image` ignores `border-radius` (square corners even
// on a rounded card) — the standard workaround is two backgrounds instead:
// an opaque one clipped to the padding box (the card's real background) painted
// over a gradient one clipped to the border box (only visible under the
// border stroke, where the padding-box layer doesn't reach), both of which
// respect the element's border-radius.
export function yarnColorFamilyBorderStyle(
  family: YarnColorFamily | null,
  surfaceColor = 'var(--color-surface)',
): { borderColor: string; background?: string } {
  if (family === 'multicolore') {
    return {
      borderColor: 'transparent',
      background: `linear-gradient(${surfaceColor}, ${surfaceColor}) padding-box, ${MULTICOLORE_GRADIENT} border-box`,
    }
  }
  return { borderColor: yarnColorFamilyVar(family) }
}
