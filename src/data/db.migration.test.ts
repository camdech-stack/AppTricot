import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'

const DB_NAME = 'mon-carnet-de-tricot'

beforeEach(async () => {
  if (db.isOpen()) db.close()
  await Dexie.delete(DB_NAME)
})

describe('schema migration to v3', () => {
  it('preserves existing settings and adds the new step-1 tables', async () => {
    // Simulate a pre-step-1 install already on schema v2.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    await legacy.open()
    await legacy.table('settings').put({
      id: 'app-settings',
      lengthUnit: 'yd',
      weightUnit: 'g',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const settings = await db.settings.get('app-settings')
    expect(settings?.lengthUnit).toBe('yd')

    expect(await db.projects.count()).toBe(0)
    expect(await db.counters.count()).toBe(0)
    expect(await db.counterEvents.count()).toBe(0)
    expect(await db.coverImages.count()).toBe(0)
  })
})

describe('schema migration to v4', () => {
  it('backfills a monotonic per-counter sequence, ordered by createdAt', async () => {
    // Simulate a step-1 install already on schema v3, with events that
    // collide on the same millisecond timestamp (a burst of rapid taps) —
    // exactly the case createdAt-only ordering gets wrong.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    await legacy.open()
    const sameTimestamp = '2024-01-01T00:00:00.000Z'
    await legacy.table('counterEvents').bulkAdd([
      { id: 'evt-1', counterId: 'counter-a', type: 'increment', delta: 1, valueBefore: 0, valueAfter: 1, undoneAt: null, createdAt: sameTimestamp, updatedAt: sameTimestamp },
      { id: 'evt-2', counterId: 'counter-a', type: 'increment', delta: 1, valueBefore: 1, valueAfter: 2, undoneAt: null, createdAt: sameTimestamp, updatedAt: sameTimestamp },
      { id: 'evt-3', counterId: 'counter-a', type: 'increment', delta: 1, valueBefore: 2, valueAfter: 3, undoneAt: null, createdAt: sameTimestamp, updatedAt: sameTimestamp },
    ])
    legacy.close()

    await db.open()

    const events = await db.counterEvents.where('counterId').equals('counter-a').toArray()
    const sequences = events.map((event) => event.sequence).sort((a, b) => a - b)
    expect(sequences).toEqual([0, 1, 2])
  })
})

describe('schema migration to v6', () => {
  it('adds the sessions table and backfills trackingEnabled without losing existing data', async () => {
    // Simulate a step-1 install already on schema v5.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    await legacy.open()
    await legacy.table('settings').put({
      id: 'app-settings',
      lengthUnit: 'yd',
      weightUnit: 'g',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    await legacy.table('projects').put({
      id: 'project-a',
      name: 'Écharpe',
      craft: 'knitting',
      description: '',
      status: 'in_progress',
      colorKey: 'prune',
      notes: '',
      startedAt: '2024-01-01',
      completedAt: null,
      targetEndDate: null,
      lastActivityAt: '2024-01-01T00:00:00.000Z',
      activeCounterId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const settings = await db.settings.get('app-settings')
    expect(settings?.lengthUnit).toBe('yd')
    expect(settings?.trackingEnabled).toBe(true)

    expect(await db.projects.get('project-a')).toBeDefined()
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('schema migration to v7', () => {
  it('adds the yarn tables and backfills yarnQuantityUnit without losing existing data', async () => {
    // Simulate a step-2 install already on schema v6.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(6).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    await legacy.open()
    await legacy.table('settings').put({
      id: 'app-settings',
      lengthUnit: 'yd',
      weightUnit: 'g',
      trackingEnabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const settings = await db.settings.get('app-settings')
    expect(settings?.lengthUnit).toBe('yd')
    expect(settings?.yarnQuantityUnit).toBe('weight')

    expect(await db.yarns.count()).toBe(0)
    expect(await db.yarnImages.count()).toBe(0)
    expect(await db.projectYarns.count()).toBe(0)
    expect(await db.yarnUsages.count()).toBe(0)
  })
})

describe('schema migration to v8', () => {
  it('backfills the Ravelry fields on existing yarns and settings without losing data', async () => {
    // Simulate a step-3a install already on schema v7, with a manually
    // entered yarn (fictitious data) predating the Ravelry fields.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(6).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    legacy.version(7).stores({
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
    await legacy.open()
    await legacy.table('settings').put({
      id: 'app-settings',
      lengthUnit: 'yd',
      weightUnit: 'g',
      trackingEnabled: true,
      yarnQuantityUnit: 'weight',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    await legacy.table('yarns').put({
      id: 'yarn-fictif-1',
      name: 'Fil fictif',
      brand: 'Marque fictive',
      line: '',
      colorName: '',
      colorRef: '',
      colorFamily: null,
      weightCategory: null,
      fiber: '',
      skeinCount: 3,
      metersPerSkein: null,
      gramsPerSkein: null,
      dyeLot: '',
      notes: '',
      price: null,
      purchasedAt: null,
      ravelryYarnId: null,
      catalogSource: 'manual',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const settings = await db.settings.get('app-settings')
    expect(settings?.lengthUnit).toBe('yd')
    expect(settings?.ravelryEnabled).toBe(false)
    expect(settings?.ravelryUsername).toBeNull()
    expect(settings?.ravelryPassword).toBeNull()

    const yarn = await db.yarns.get('yarn-fictif-1')
    expect(yarn?.name).toBe('Fil fictif')
    expect(yarn?.ravelryPermalink).toBeNull()
    expect(yarn?.catalogFields).toEqual([])
    expect(yarn?.catalogFetchedAt).toBeNull()
  })
})

describe('schema migration to v9', () => {
  it('adds the pattern tables and backfills lastWorkTab without losing existing data', async () => {
    // Simulate a step-3b install already on schema v8, with a project
    // predating lastWorkTab.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(6).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    legacy.version(7).stores({
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
    legacy.version(8).stores({
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
    await legacy.open()
    await legacy.table('projects').put({
      id: 'project-a',
      name: 'Écharpe',
      craft: 'knitting',
      description: '',
      status: 'in_progress',
      colorKey: 'prune',
      notes: '',
      startedAt: '2024-01-01',
      completedAt: null,
      targetEndDate: null,
      lastActivityAt: '2024-01-01T00:00:00.000Z',
      activeCounterId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const project = await db.projects.get('project-a')
    expect(project?.name).toBe('Écharpe')
    expect(project?.lastWorkTab).toBeNull()

    expect(await db.patterns.count()).toBe(0)
    expect(await db.patternFiles.count()).toBe(0)
    expect(await db.patternCovers.count()).toBe(0)
    expect(await db.projectPatterns.count()).toBe(0)
    expect(await db.patternViewStates.count()).toBe(0)
  })
})

describe('schema migration to v10', () => {
  it('backfills materials on existing patterns without losing data', async () => {
    // Simulate a step-4 install already on schema v9, with a pattern
    // predating the materials field.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(6).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    legacy.version(7).stores({
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
    legacy.version(8).stores({
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
    legacy.version(9).stores({
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
    await legacy.open()
    await legacy.table('patterns').put({
      id: 'pattern-a',
      name: 'Pull torsades',
      craft: 'knitting',
      tags: [],
      source: '',
      notes: '',
      pageCount: 10,
      sizeBytes: 1000,
      fileName: 'pull.pdf',
      fileHash: 'hash-a',
      fileVersion: 1,
      fileUpdatedAt: '2024-01-01T00:00:00.000Z',
      lastOpenedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const pattern = await db.patterns.get('pattern-a')
    expect(pattern?.name).toBe('Pull torsades')
    expect(pattern?.materials).toBe('')
  })
})

describe('schema migration to v11', () => {
  it('adds the guide tables without losing existing data', async () => {
    // Simulate a step-4 install already on schema v10, with a pattern
    // predating the guide tables.
    const legacy = new Dexie(DB_NAME)
    legacy.version(1).stores({ settings: 'id' })
    legacy.version(2).stores({ settings: 'id' })
    legacy.version(3).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(4).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(5).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
    })
    legacy.version(6).stores({
      settings: 'id',
      projects: 'id, status, lastActivityAt',
      counters: 'id, projectId, [projectId+position]',
      counterEvents: 'id, counterId, [counterId+createdAt]',
      coverImages: 'id, projectId',
      sessions: 'id, projectId, startedAt, [projectId+startedAt]',
    })
    legacy.version(7).stores({
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
    legacy.version(8).stores({
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
    legacy.version(9).stores({
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
    legacy.version(10).stores({
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
    await legacy.open()
    await legacy.table('patterns').put({
      id: 'pattern-a',
      name: 'Pull torsades',
      craft: 'knitting',
      tags: [],
      source: '',
      materials: '',
      notes: '',
      pageCount: 10,
      sizeBytes: 1000,
      fileName: 'pull.pdf',
      fileHash: 'hash-a',
      fileVersion: 1,
      fileUpdatedAt: '2024-01-01T00:00:00.000Z',
      lastOpenedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    legacy.close()

    await db.open()

    const pattern = await db.patterns.get('pattern-a')
    expect(pattern?.name).toBe('Pull torsades')

    expect(await db.guides.count()).toBe(0)
    expect(await db.guideContents.count()).toBe(0)
    expect(await db.projectGuides.count()).toBe(0)
  })
})
