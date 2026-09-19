// Shared shape for every persisted entity: a stable UUID plus audit timestamps.
// Every future table (projects, counters, yarns, patterns, ...) should build
// on this so migrations and exports stay consistent across the app.
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export type LengthUnit = 'm' | 'yd'
export type WeightUnit = 'g'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface AppSettingsRecord extends BaseEntity {
  lengthUnit: LengthUnit
  weightUnit: WeightUnit
  theme: ThemePreference
}
