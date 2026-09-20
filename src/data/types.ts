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

// How yarn quantities display across the app: 'skein' (pelotes), 'weight'
// (grams) or 'length' (meters/yards, sub-choice from `lengthUnit`).
export type YarnQuantityUnit = 'skein' | 'weight' | 'length'

export interface AppSettingsRecord extends BaseEntity {
  lengthUnit: LengthUnit
  weightUnit: WeightUnit
  trackingEnabled: boolean
  yarnQuantityUnit: YarnQuantityUnit
  // Ravelry catalog search (step 3b) — secrets, read-only credentials the
  // user creates on Ravelry's own site. Never logged, never put in a URL,
  // and must stay excluded from any future export/backup (step 7).
  ravelryEnabled: boolean
  ravelryUsername: string | null
  ravelryPassword: string | null
}

export type ProjectCraft = 'knitting' | 'crochet'
export type ProjectStatus = 'todo' | 'in_progress' | 'paused' | 'done'

// Canonical list of project colors: source of truth for both the persisted
// `colorKey` field and the UI (StripedProgressBar re-exports this type).
export type ProjectColorKey = 'prune' | 'pervenche' | 'terracotta' | 'peche' | 'rouge' | 'rose'

// Which pane of the project work view (step 4) was last active. Read by
// step 6's "Continuer" to reopen a project exactly where it was left, and
// unused (null) until a project has at least one linked pattern.
export type ProjectWorkTab = 'pattern' | 'counter' | 'guide'

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
  lastWorkTab: ProjectWorkTab | null
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

// How a session was created: `auto` = the first counter tap on a target
// opened it implicitly; `manual` = the chrono button (or the "add a manual
// session" form in the history sheet) created it explicitly.
export type SessionSource = 'auto' | 'manual'

// What triggered/created the session. `guide` is unused until step 5b, which
// will call `recordActivity`/`startSession` with origin "guide" and the
// guide's projectId — see CLAUDE.md.
export type SessionOrigin = 'counter' | 'guide' | 'manual'

export type SessionEndReason = 'user_stop' | 'app_hidden' | 'switched' | 'recovered'

export interface SessionRecord extends BaseEntity {
  // null = time spent on the standalone counter (counted in global stats,
  // never in a project's time stats — see CLAUDE.md "Attribution du temps").
  projectId: string | null
  startedAt: string
  // null while the session is open.
  endedAt: string | null
  // Recovery-only heartbeat, written every 10s while open and visible, and
  // on every activity write. Never used as an inactivity timeout.
  lastHeartbeatAt: string
  source: SessionSource
  origin: SessionOrigin
  endReason: SessionEndReason | null
}

export type YarnColorFamily =
  | 'rouge'
  | 'rose'
  | 'orange'
  | 'jaune'
  | 'vert'
  | 'bleu'
  | 'violet'
  | 'marron'
  | 'gris'
  | 'noir'
  | 'blanc'
  | 'multicolore'

export type YarnWeightCategory =
  | 'dentelle'
  | 'chaussettes'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'aran'
  | 'bulky'
  | 'super_bulky'
  | 'autre'

// Where a yarn entry came from. 'manual' today; 'ravelry' is unused until
// step 3b wires up the catalog search — see CLAUDE.md.
export type YarnCatalogSource = 'manual' | 'ravelry'

export interface YarnRecord extends BaseEntity {
  name: string
  brand: string
  line: string
  colorName: string
  colorRef: string
  colorFamily: YarnColorFamily | null
  weightCategory: YarnWeightCategory | null
  fiber: string
  // Skein count, decimals allowed (e.g. 2.5).
  skeinCount: number
  metersPerSkein: number | null
  gramsPerSkein: number | null
  dyeLot: string
  notes: string
  price: number | null
  purchasedAt: string | null
  ravelryYarnId: string | null
  catalogSource: YarnCatalogSource
  // Full URL to the yarn's Ravelry page, shown as an external link on the
  // yarn detail page. Null for manual entries.
  ravelryPermalink: string | null
  // Names of the fields whose value still matches what the catalog search
  // filled in — see CLAUDE.md "Modèle de données (étape 3b)". Empty by
  // default; only ever non-empty for catalogSource === 'ravelry'.
  catalogFields: string[]
  catalogFetchedAt: string | null
}

// A draft used to prefill the yarn form — typed today so step 3b's Ravelry
// search can hand one to the same form without changing its shape.
export type YarnDraft = Partial<
  Pick<
    YarnRecord,
    | 'name'
    | 'brand'
    | 'line'
    | 'colorName'
    | 'colorRef'
    | 'colorFamily'
    | 'weightCategory'
    | 'fiber'
    | 'metersPerSkein'
    | 'gramsPerSkein'
    | 'ravelryYarnId'
    | 'ravelryPermalink'
    | 'catalogSource'
  >
>

export interface YarnImageRecord extends BaseEntity {
  yarnId: string
  blob: Blob
}

export type YarnQuantityUnitValue = 'g' | 'm' | 'skein'

// One link between a project and a yarn: how much of that yarn the project
// plans to use. At most one per (projectId, yarnId) pair.
export interface ProjectYarnRecord extends BaseEntity {
  projectId: string
  yarnId: string
  plannedValue: number
  plannedUnit: YarnQuantityUnitValue
}

// A logged consumption entry — the source of truth for how much of a yarn
// has been used. projectId null = consumption not tied to any project.
export interface YarnUsageRecord extends BaseEntity {
  yarnId: string
  projectId: string | null
  value: number
  unit: YarnQuantityUnitValue
  usedAt: string
  note: string
}

// Step 4: pattern library. `craft` is nullable (unlike ProjectRecord's,
// which is required) since a pattern can be imported before its craft is
// known or simply left unset.
export interface PatternRecord extends BaseEntity {
  name: string
  craft: ProjectCraft | null
  // Normalized (trimmed, deduplicated case-insensitively) — see
  // src/data/tagUtils.ts. Indexed multiEntry for tag search/filters.
  tags: string[]
  source: string
  notes: string
  pageCount: number
  sizeBytes: number
  fileName: string
  // SHA-256 hex digest of the PDF bytes, used for duplicate detection on
  // import — see src/data/patternHash.ts.
  fileHash: string
  // Starts at 1, incremented every time the file is replaced (never the
  // metadata-only edits) — see replacePatternFile.
  fileVersion: number
  fileUpdatedAt: string
  lastOpenedAt: string | null
}

// The PDF bytes themselves, in a separate table from `patterns` so list
// queries never touch large blobs — same reasoning as coverImages/
// yarnImages. 1:1 with its pattern (id doubles as patternId), replaced in
// place on "Remplacer le fichier" rather than versioned.
export interface PatternFileRecord extends BaseEntity {
  patternId: string
  blob: Blob
}

export type PatternCoverKind = 'auto' | 'custom'

// 1:1 with its pattern, same id-doubling convention as PatternFileRecord.
// `kind` distinguishes the auto-generated first-page render (regenerated
// whenever the file is replaced) from a user-chosen photo (kept as-is).
export interface PatternCoverRecord extends BaseEntity {
  patternId: string
  blob: Blob
  kind: PatternCoverKind
}

// Many-to-many: a project can link several patterns (position orders them),
// and a pattern can be linked to several projects. At most one link per
// (projectId, patternId) pair.
export interface ProjectPatternRecord extends BaseEntity {
  projectId: string
  patternId: string
  position: number
}

// Reading position for a pattern, scoped per (patternId, projectId) pair —
// projectId null means "opened straight from the library, not from a
// project". page/zoom/offset are normalized (independent of screen size),
// at most one row per pair (see savePatternViewState).
export interface PatternViewStateRecord extends BaseEntity {
  patternId: string
  projectId: string | null
  page: number
  zoom: number
  offsetX: number
  offsetY: number
}
