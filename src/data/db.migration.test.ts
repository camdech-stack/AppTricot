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
