import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettingsRecord,
  CounterEventRecord,
  CounterRecord,
  CoverImageRecord,
  GuideContentRecord,
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

  constructor() {
    super('mon-carnet-de-tricot')

    this.version(1).stores({
      settings: 'id',
    })

    // Dropped the `theme` field: the app is light-only now (see CLAUDE.md).
    // Not indexed, so the schema string is unchanged; still bumping the
    // version to backfill existing installs per the migration convention above.
    this.version(2)
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
    this.version(3).stores({
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
    this.version(4)
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
    this.version(5)
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
    this.version(6)
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
    this.version(7)
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
    this.version(8)
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
    this.version(9)
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
    this.version(10)
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
    this.version(11).stores({
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
  }
}

export const db = new AppDatabase()
