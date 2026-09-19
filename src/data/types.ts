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

export interface AppSettingsRecord extends BaseEntity {
  lengthUnit: LengthUnit
  weightUnit: WeightUnit
}

export type ProjectCraft = 'knitting' | 'crochet'
export type ProjectStatus = 'todo' | 'in_progress' | 'paused' | 'done'

// Canonical list of project colors: source of truth for both the persisted
// `colorKey` field and the UI (StripedProgressBar re-exports this type).
export type ProjectColorKey = 'prune' | 'pervenche' | 'terracotta' | 'peche' | 'rouge' | 'rose'

export interface ProjectRecord extends BaseEntity {
  name: string
  craft: ProjectCraft
  description: string
  status: ProjectStatus
  colorKey: ProjectColorKey
  notes: string
  // Calendar dates (YYYY-MM-DD), not timestamps: edited by hand via a date
  // input, independent of when the record itself was created/touched.
  startedAt: string | null
  completedAt: string | null
  // Planned/target end date, distinct from completedAt (the actual date the
  // project was marked done). Purely informational, never auto-filled.
  targetEndDate: string | null
  lastActivityAt: string
  activeCounterId: string | null
}

export interface CounterRecord extends BaseEntity {
  // null = standalone counter, not attached to any project.
  projectId: string | null
  name: string
  value: number
  goal: number | null
  position: number
  isMain: boolean
  lastTappedAt: string | null
}

export type CounterEventType = 'increment' | 'decrement' | 'reset' | 'set'

export interface CounterEventRecord extends BaseEntity {
  counterId: string
  type: CounterEventType
  delta: number
  valueBefore: number
  valueAfter: number
  undoneAt: string | null
  // Monotonic per-counter ordering key (0, 1, 2, ...), computed inside the
  // same transaction as the write. createdAt alone can't order events
  // reliably: two rapid taps can land in the same millisecond.
  sequence: number
}

export interface CoverImageRecord extends BaseEntity {
  projectId: string
  blob: Blob
}
