import { metersToYards, skeinsToAmount } from '../data/yarnMath'
import type { LengthUnit, YarnQuantityUnit, YarnRecord } from '../data/types'

function formatNumberFr(value: number, maxDecimals: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDecimals }).format(value)
}

// Renders a skein amount in the app's chosen display unit (settings.yarnQuantityUnit).
// Falls back to pelotes when the yarn is missing the per-skein figure the
// chosen unit needs — skeins are always computable, that conversion never fails.
export function formatYarnQuantity(
  skeins: number | null,
  yarn: Pick<YarnRecord, 'gramsPerSkein' | 'metersPerSkein'>,
  displayUnit: YarnQuantityUnit,
  lengthUnit: LengthUnit,
): string {
  if (skeins === null) return 'Stock dépassé'

  if (displayUnit === 'weight') {
    const grams = skeinsToAmount(skeins, 'g', yarn)
    if (grams !== null) return `${formatNumberFr(grams, 0)} g`
  }

  if (displayUnit === 'length') {
    const meters = skeinsToAmount(skeins, 'm', yarn)
    if (meters !== null) {
      return lengthUnit === 'yd' ? `${formatNumberFr(metersToYards(meters), 0)} yd` : `${formatNumberFr(meters, 0)} m`
    }
  }

  const label = skeins <= 1 ? 'pelote' : 'pelotes'
  return `${formatNumberFr(skeins, 2)} ${label}`
}

// Formats a raw value entered/stored in a specific unit (g, m or skein),
// e.g. for a usage or planned-quantity row that already carries its own unit.
export function formatYarnAmount(value: number, unit: 'g' | 'm' | 'skein', lengthUnit: LengthUnit): string {
  if (unit === 'g') return `${formatNumberFr(value, 0)} g`
  if (unit === 'skein') return `${formatNumberFr(value, 2)} ${value <= 1 ? 'pelote' : 'pelotes'}`
  return lengthUnit === 'yd' ? `${formatNumberFr(metersToYards(value), 0)} yd` : `${formatNumberFr(value, 0)} m`
}
