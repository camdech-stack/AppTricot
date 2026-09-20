import { metersToYards, yardsToMeters } from '../../data/yarnMath'
import type { LengthUnit, YarnQuantityUnitValue } from '../../data'

// The unit choice offered in a quantity input: 'length' covers both meters
// and yards (the app's `lengthUnit` setting picks which), converted to
// meters — the stored unit — before saving.
export type QuantityUnitChoice = 'g' | 'length' | 'skein'

export function quantityUnitLabel(choice: QuantityUnitChoice, lengthUnit: LengthUnit): string {
  if (choice === 'g') return 'g'
  if (choice === 'skein') return 'pelote(s)'
  return lengthUnit === 'yd' ? 'yd' : 'm'
}

// Resolves a raw text input + unit choice into the stored {value, unit}
// pair (always g, m or skein), converting yards to meters as it goes.
export function resolveQuantityInput(
  rawValue: string,
  choice: QuantityUnitChoice,
  lengthUnit: LengthUnit,
): { value: number; unit: YarnQuantityUnitValue } | null {
  const parsed = Number(rawValue)
  if (rawValue.trim() === '' || !Number.isFinite(parsed)) return null

  if (choice === 'g') return { value: parsed, unit: 'g' }
  if (choice === 'skein') return { value: parsed, unit: 'skein' }
  return { value: lengthUnit === 'yd' ? yardsToMeters(parsed) : parsed, unit: 'm' }
}

// A stored value's unit label, for editing an existing record whose unit is
// fixed (unlike a fresh entry, which lets the user pick).
export function storedUnitLabel(unit: YarnQuantityUnitValue, lengthUnit: LengthUnit): string {
  if (unit === 'g') return 'g'
  if (unit === 'skein') return 'pelote(s)'
  return lengthUnit === 'yd' ? 'yd' : 'm'
}

// Converts a stored value (always meters for length) to the app's display
// unit, for editing — and back on save.
export function storedValueToDisplay(value: number, unit: YarnQuantityUnitValue, lengthUnit: LengthUnit): number {
  if (unit === 'm' && lengthUnit === 'yd') return metersToYards(value)
  return value
}

export function displayValueToStored(value: number, unit: YarnQuantityUnitValue, lengthUnit: LengthUnit): number {
  if (unit === 'm' && lengthUnit === 'yd') return yardsToMeters(value)
  return value
}
