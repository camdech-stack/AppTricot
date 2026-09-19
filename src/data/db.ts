import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettingsRecord,
  CounterEventRecord,
  CounterRecord,
  CoverImageRecord,
  ProjectRecord,
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
  }
}

export const db = new AppDatabase()
