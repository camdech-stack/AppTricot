import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type {
  AppSettingsRecord,
  CounterEventRecord,
  CounterRecord,
  CoverImageRecord,
  GuideContentRecord,
  GuideProgressRecord,
  GuideRecord,
  PatternCoverRecord,
  PatternFileRecord,
  PatternRecord,
  PatternViewStateRecord,
  ProjectGuideRecord,
  ProjectPatternRecord,
  ProjectRecord,
  ProjectYarnRecord,
  SessionRecord,
  YarnImageRecord,
  YarnRecord,
  YarnUsageRecord,
} from './types'

// Schema migration convention:
// - Never edit a past `.version(n)` call once it has shipped.
// - Add a new `.version(n + 1).stores({...}).upgrade(tx => {...})` block for
//   every schema change, even additive ones, so existing installs migrate
//   cleanly instead of losing data.
// - Dexie stores only indexed fields in the schema string; new non-indexed
//   fields on existing records can be added without a schema change, but
//   still bump the version and backfill them in `.upgrade()`.
class AppDatabase extends Dexie {
  settings!: EntityTable<AppSettingsRecord, 'id'>
  projects!: EntityTable<ProjectRecord, 'id'>
  counters!: EntityTable<CounterRecord, 'id'>
  counterEvents!: EntityTable<CounterEventRecord, 'id'>
  coverImages!: EntityTable<CoverImageRecord, 'id'>
  sessions!: EntityTable<SessionRecord, 'id'>
  yarns!: EntityTable<YarnRecord, 'id'>
  yarnImages!: EntityTable<YarnImageRecord, 'id'>
  projectYarns!: EntityTable<ProjectYarnRecord, 'id'>
  yarnUsages!: EntityTable<YarnUsageRecord, 'id'>
  patterns!: EntityTable<PatternRecord, 'id'>
  patternFiles!: EntityTable<PatternFileRecord, 'id'>
  patternCovers!: EntityTable<PatternCoverRecord, 'id'>
  projectPatterns!: EntityTable<ProjectPatternRecord, 'id'>
  patternViewStates!: EntityTable<PatternViewStateRecord, 'id'>
  guides!: EntityTable<GuideRecord, 'id'>
  guideContents!: EntityTable<GuideContentRecord, 'id'>
  projectGuides!: EntityTable<ProjectGuideRecord, 'id'>
  guideProgress!: EntityTable<GuideProgressRecord, 'id'>

  constructor() {
    super('mon-carnet-de-tricot')
    declareSchema(this)
  }
}

// Highest schema version declared below. Backups record it so an import can
// tell whether the file comes from an older or a newer app (see src/data/backup).
export const CURRENT_SCHEMA_VERSION = 14

interface VersionDeclaration {
  stores(schema: Record<string, string | null>): VersionDeclaration
  upgrade(fn: (tx: Transaction) => void | PromiseLike<void>): VersionDeclaration
}

const SKIPPED_VERSION: VersionDeclaration = {
  stores: () => SKIPPED_VERSION,
  upgrade: () => SKIPPED_VERSION,
}

// Declares every schema version on `target`, up to `upToVersion`. Shared by
// the app database and by the throwaway databases that migrate an old backup
// (src/data/backup/migrateBackup.ts), so the `.upgrade()` functions below are
// the single source of truth for data migrations.
export function declareSchema(target: Dexie, upToVersion: number = CURRENT_SCHEMA_VERSION): void {
  const declare = (version: number): VersionDeclaration =>
    version <= upToVersion ? target.version(version) : SKIPPED_VERSION

  declare(1).stores({
    settings: 'id',
  })

  // Dropped the `theme` field: the app is light-only now (see CLAUDE.md).
  // Not indexed, so the schema string is unchanged; still bumping the
  // version to backfill existing installs per the migration convention above.
  declare(2)
    .stores({
      settings: 'id',
    })
    .upgrade(async (tx) => {
      await tx
        .table('settings')
        .toCollection()
        .modify((record: Record<string, unknown>) => {
          delete record.theme
        })
    })

  // Step 1: projects, their counters, counter events and cover images.
  // `settings` is repeated unchanged so existing installs keep it intact.
  declare(3).stores({
    settings: 'id',
    projects: 'id, status, lastActivityAt',
    counters: 'id, projectId, [projectId+position]',
    counterEvents: 'id, counterId, [counterId+createdAt]',
    coverImages: 'id, projectId',
  })

  // Adds `sequence` (a monotonic per-counter ordering key) to
  // counterEvents: `createdAt` alone can't order two events created in the
  // same millisecond, which undo/history need to get right. Not indexed,
  // so the schema string is unchanged; still bumping the version to
  // backfill existing rows per the migration convention above.
  declare(4)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    .upgrade(async (tx) => {
      const table = tx.table('counterEvents')
      const events = (await table.toArray()) as { id: string; counterId: string; createdAt: string }[]
      events.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      const nextSequenceByCounter = new Map<string, number>()
      for (const event of events) {
        const sequence = nextSequenceByCounter.get(event.counterId) ?? 0
        nextSequenceByCounter.set(event.counterId, sequence + 1)
        await table.update(event.id, { sequence })
      }
    })

  // Adds `targetEndDate` (planned end date, distinct from completedAt) to
  // projects. Not indexed, so the schema string is unchanged; still
  // bumping the version to backfill existing rows.
  declare(5)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    .upgrade(async (tx) => {
      await tx
        .table('projects')
        .toCollection()
        .modify((project: Record<string, unknown>) => {
          project.targetEndDate = null
        })
    })

  // Step 2: time tracking. Adds the `sessions` table and `trackingEnabled`
  // on settings (not indexed, so its schema string is unchanged).
  // `startedAt` is indexed (not `endedAt`, which is null while a session
  // is open — IndexedDB never indexes a null property, see
  // countersRepository's standalone-counter comment for the same
  // constraint) so history/stats queries can sort project sessions
  // without a full-table scan; open-session lookups (closeOrphanSessions)
  // scan the small `sessions` table directly, same as standalone counters.
  declare(6)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    .upgrade(async (tx) => {
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Record<string, unknown>) => {
          settings.trackingEnabled = true
        })
    })

  // Step 3a: yarn stock. Adds `yarns`, `yarnImages`, `projectYarns` (one
  // link per project/yarn pair) and `yarnUsages` (the consumption log),
  // plus `yarnQuantityUnit` on settings (not indexed, so its schema string
  // is unchanged). No network calls anywhere here — catalogSource is
  // always 'manual' until step 3b wires up Ravelry search.
  declare(7)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
    })
    .upgrade(async (tx) => {
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Record<string, unknown>) => {
          settings.yarnQuantityUnit = 'weight'
        })
    })

  // Step 3b: Ravelry catalog search. Adds `ravelryPermalink`,
  // `catalogFields` and `catalogFetchedAt` on yarns, plus `ravelryEnabled`/
  // `ravelryUsername`/`ravelryPassword` on settings — none indexed, so the
  // schema string is unchanged. See CLAUDE.md for the full field list and
  // the license rules around these credentials.
  declare(8)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
    })
    .upgrade(async (tx) => {
      await tx
        .table('yarns')
        .toCollection()
        .modify((yarn: Record<string, unknown>) => {
          yarn.ravelryPermalink = null
          yarn.catalogFields = []
          yarn.catalogFetchedAt = null
        })
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Record<string, unknown>) => {
          settings.ravelryEnabled = false
          settings.ravelryUsername = null
          settings.ravelryPassword = null
        })
    })

  // Step 4: pattern library. Adds `patterns`, `patternFiles` (1:1, PDF
  // blob), `patternCovers` (1:1, JPEG blob), `projectPatterns` (many-to-
  // many link, one per project/pattern pair) and `patternViewStates`
  // (reading position per patternId+projectId pair — projectId can be
  // null, which IndexedDB never indexes, so it's looked up by patternId
  // alone and filtered in JS, same workaround as standalone counters/
  // sessions). Also adds `lastWorkTab` on projects (not indexed, so its
  // schema string is unchanged).
  declare(9)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
      patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
      patternFiles: 'id, patternId',
      patternCovers: 'id, patternId',
      projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
      patternViewStates: 'id, patternId, projectId',
    })
    .upgrade(async (tx) => {
      await tx
        .table('projects')
        .toCollection()
        .modify((project: Record<string, unknown>) => {
          project.lastWorkTab = null
        })
    })

  // Adds `materials` (free text, one detected item per line) to
  // patterns — its own dedicated, always-editable field rather than text
  // folded into notes. Not indexed, so the schema string is unchanged.
  declare(10)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
      patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
      patternFiles: 'id, patternId',
      patternCovers: 'id, patternId',
      projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
      patternViewStates: 'id, patternId, projectId',
    })
    .upgrade(async (tx) => {
      await tx
        .table('patterns')
        .toCollection()
        .modify((pattern: Record<string, unknown>) => {
          pattern.materials = ''
        })
    })

  // Step 5a: pattern guides. Adds `guides` (metadata), `guideContents`
  // (the tree itself, in its own table so lists stay fast — see
  // CLAUDE.md "Modèle de données (étape 5a)") and `projectGuides` (one
  // link per project/guide pair, a guide can be reused across several
  // projects). All three are brand new tables, nothing to backfill.
  declare(11).stores({
    settings: 'id',
    projects: 'id, status, lastActivityAt',
    counters: 'id, projectId, [projectId+position]',
    counterEvents: 'id, counterId, [counterId+createdAt]',
    coverImages: 'id, projectId',
    sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    yarns: 'id, name',
    yarnImages: 'id, yarnId',
    projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
    yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
    patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
    patternFiles: 'id, patternId',
    patternCovers: 'id, patternId',
    projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
    patternViewStates: 'id, patternId, projectId',
    guides: 'id, patternId, createdAt',
    guideContents: 'id, guideId',
    projectGuides: 'id, projectId, guideId, [projectId+guideId]',
  })

  // Step 5b: progress through a guide, per (project, guide) pair — never
  // inside the guide's own content tree (see guideProgress.ts). Brand new
  // table, nothing to backfill.
  declare(12).stores({
    settings: 'id',
    projects: 'id, status, lastActivityAt',
    counters: 'id, projectId, [projectId+position]',
    counterEvents: 'id, counterId, [counterId+createdAt]',
    coverImages: 'id, projectId',
    sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    yarns: 'id, name',
    yarnImages: 'id, yarnId',
    projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
    yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
    patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
    patternFiles: 'id, patternId',
    patternCovers: 'id, patternId',
    projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
    patternViewStates: 'id, patternId, projectId',
    guides: 'id, patternId, createdAt',
    guideContents: 'id, guideId',
    projectGuides: 'id, projectId, guideId, [projectId+guideId]',
    guideProgress: 'id, projectId, guideId, [projectId+guideId]',
  })

  // Adds `guideRowTextSize` (row text size on the guide follow screen) to
  // settings. Not indexed, so its schema string is unchanged; still
  // bumping the version to backfill existing installs.
  declare(13)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
      patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
      patternFiles: 'id, patternId',
      patternCovers: 'id, patternId',
      projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
      patternViewStates: 'id, patternId, projectId',
      guides: 'id, patternId, createdAt',
      guideContents: 'id, guideId',
      projectGuides: 'id, projectId, guideId, [projectId+guideId]',
      guideProgress: 'id, projectId, guideId, [projectId+guideId]',
    })
    .upgrade(async (tx) => {
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Record<string, unknown>) => {
          settings.guideRowTextSize = 'medium'
        })
    })

  // Backup and reminder settings (step 7). Not indexed, so the schema string
  // is unchanged; still bumping the version to backfill existing installs.
  declare(14)
    .stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
      yarns: 'id, name',
      yarnImages: 'id, yarnId',
      projectYarns: 'id, projectId, yarnId, [projectId+yarnId]',
      yarnUsages: 'id, yarnId, projectId, [yarnId+usedAt]',
      patterns: 'id, name, *tags, fileHash, createdAt, lastOpenedAt',
      patternFiles: 'id, patternId',
      patternCovers: 'id, patternId',
      projectPatterns: 'id, projectId, patternId, [projectId+patternId]',
      patternViewStates: 'id, patternId, projectId',
      guides: 'id, patternId, createdAt',
      guideContents: 'id, guideId',
      projectGuides: 'id, projectId, guideId, [projectId+guideId]',
      guideProgress: 'id, projectId, guideId, [projectId+guideId]',
    })
    .upgrade(async (tx) => {
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: Record<string, unknown>) => {
          settings.lastBackupAt = null
          settings.backupReminderEnabled = true
          settings.backupReminderIntervalDays = 14
          settings.backupReminderSnoozedAt = null
        })
    })
}

export const db = new AppDatabase()
