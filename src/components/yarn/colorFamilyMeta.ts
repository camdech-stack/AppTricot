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

// Returns either a plain border-color or, for "multicolore", a CSS
// `border-image` shorthand value — the caller applies whichever property
// its CSS actually declares based on `colorFamily === 'multicolore'`.
export function yarnColorFamilyBorderStyle(family: YarnColorFamily | null): { borderColor?: string; borderImage?: string } {
  if (family === 'multicolore') return { borderImage: `${MULTICOLORE_GRADIENT} 1` }
  return { borderColor: yarnColorFamilyVar(family) }
}
