import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION, db } from '../db'
import { getSettings, updateSettings } from '../settingsRepository'
import { emptyGuideContent } from '../guideModel'
import { BackupError } from './backupError'
import { BACKUP_FILE_PREFIX, BACKUP_TABLES, getBackupFileName } from './format'
import { buildBackup } from './exportBackup'
import { openBackup } from './readBackup'
import { restoreBackup } from './restoreBackup'
import { getBackupExcludedSettingsKeys } from './secrets'
import { decideReminderForSession, getBackupReminderState, resetReminderSessionForTests } from './reminder'

const NOW = '2026-03-01T10:00:00.000Z'
const SECRET_USER = 'ravelry-user-SECRET-123'
const SECRET_PASSWORD = 'ravelry-pass-SECRET-456'

function base(id: string) {
  return { id, createdAt: NOW, updatedAt: NOW }
}

function pdfBlob(): Blob {
  return new Blob([new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3, 250, 251])], { type: 'application/pdf' })
}

function jpgBlob(seed: number): Blob {
  return new Blob([new Uint8Array([255, 216, 255, seed, 9, 8, 7])], { type: 'image/jpeg' })
}

async function seed() {
  await db.settings.clear()
  await updateSettings({ ravelryEnabled: true, ravelryUsername: SECRET_USER, ravelryPassword: SECRET_PASSWORD, lengthUnit: 'yd' })
  await db.projects.add({
    ...base('p1'), name: 'Pull', craft: 'knitting', description: '', status: 'in_progress', colorKey: 'prune', notes: 'n',
    startedAt: '2026-02-01', completedAt: null, targetEndDate: null, lastActivityAt: NOW, activeCounterId: 'c1', lastWorkTab: null,
  })
  await db.counters.add({ ...base('c1'), projectId: 'p1', name: 'Rangs', value: 3, goal: null, position: 0, isMain: true, lastTappedAt: NOW })
  await db.counterEvents.add({ ...base('e1'), counterId: 'c1', type: 'increment', delta: 1, valueBefore: 2, valueAfter: 3, undoneAt: null, sequence: 0 })
  await db.coverImages.add({ ...base('p1'), projectId: 'p1', blob: jpgBlob(1) })
  await db.sessions.add({
    ...base('s1'), projectId: 'p1', startedAt: NOW, endedAt: NOW, lastHeartbeatAt: NOW, source: 'auto', origin: 'counter', endReason: 'user_stop',
  })
  await db.yarns.add({
    ...base('y1'), name: 'Mérinos', brand: '', line: '', colorName: '', colorRef: '', colorFamily: null, weightCategory: null, fiber: '',
    skeinCount: 4, metersPerSkein: 100, gramsPerSkein: 50, dyeLot: '', notes: '', price: null, purchasedAt: null, ravelryYarnId: null,
    catalogSource: 'manual', ravelryPermalink: null, catalogFields: [], catalogFetchedAt: null,
  })
  await db.yarnImages.add({ ...base('y1'), yarnId: 'y1', blob: jpgBlob(2) })
  await db.projectYarns.add({ ...base('py1'), projectId: 'p1', yarnId: 'y1', plannedValue: 2, plannedUnit: 'skein' })
  await db.yarnUsages.add({ ...base('u1'), yarnId: 'y1', projectId: 'p1', value: 1, unit: 'skein', usedAt: '2026-02-02', note: '' })
  await db.patterns.add({
    ...base('pat1'), name: 'Patron', craft: 'knitting', tags: ['a'], source: '', materials: '', notes: '', pageCount: 1, sizeBytes: 10,
    fileName: 'p.pdf', fileHash: 'abc', fileVersion: 1, fileUpdatedAt: NOW, lastOpenedAt: null,
  })
  await db.patternFiles.add({ ...base('pat1'), patternId: 'pat1', blob: pdfBlob() })
  await db.patternCovers.add({ ...base('pat1'), patternId: 'pat1', blob: jpgBlob(3), kind: 'auto' })
  await db.projectPatterns.add({ ...base('pp1'), projectId: 'p1', patternId: 'pat1', position: 0 })
  await db.patternViewStates.add({ ...base('v1'), patternId: 'pat1', projectId: 'p1', page: 1, zoom: 1, offsetX: 0, offsetY: 0 })
  await db.guides.add({ ...base('g1'), name: 'Guide', craft: 'knitting', patternId: 'pat1', sizeLabel: null, notes: '', lastEditedNodeId: null })
  await db.guideContents.add({ ...base('g1'), guideId: 'g1', schemaVersion: 1, content: emptyGuideContent() })
  await db.projectGuides.add({ ...base('pg1'), projectId: 'p1', guideId: 'g1', position: 0 })
  await db.guideProgress.add({
    ...base('gp1'), projectId: 'p1', guideId: 'g1', activePieceId: null, pieces: {}, linkedCounterId: null,
    startedAt: NOW, lastAdvancedAt: NOW, completedAt: null,
  })
}

async function snapshot() {
  const result: Record<string, unknown[]> = {}
  for (const name of BACKUP_TABLES) {
    const rows = await db.table(name).toArray()
    result[name] = await Promise.all(
      rows.map(async (row: Record<string, unknown>) =>
        row.blob instanceof Blob ? { ...row, blob: Array.from(new Uint8Array(await row.blob.arrayBuffer())), blobType: row.blob.type } : row,
      ),
    )
    result[name].sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)))
  }
  return result
}

async function buildAndOpen() {
  const built = await buildBackup()
  return { built, opened: await openBackup(built.blob) }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await getSettings()
})

describe('schema', () => {
  it('keeps CURRENT_SCHEMA_VERSION in sync with the database', () => {
    expect(db.verno).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('names the file with the app prefix and a local timestamp', () => {
    expect(BACKUP_FILE_PREFIX).toBe('tricot-sauvegarde')
    expect(getBackupFileName(new Date(2026, 9, 7, 14, 5))).toBe('tricot-sauvegarde-2026-10-07-14h05.zip')
  })
})

describe('buildBackup', () => {
  it('writes every table, the manifest and the binary files at the expected paths', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(typeof manifest.exportedAt).toBe('string')
    const data = JSON.parse(await zip.file('data.json')!.async('string'))
    for (const name of BACKUP_TABLES) {
      expect(Array.isArray(data[name])).toBe(true)
      expect(manifest.counts[name]).toBe(data[name].length)
    }
    expect(data.projects).toHaveLength(1)
    expect(data.coverImages[0].blob).toBeUndefined()

    for (const path of [
      'files/coverImages/p1.jpg',
      'files/yarnImages/y1.jpg',
      'files/patternFiles/pat1.pdf',
      'files/patternCovers/pat1.jpg',
    ]) {
      expect(zip.file(path), path).not.toBeNull()
    }
    const pdf = await zip.file('files/patternFiles/pat1.pdf')!.async('uint8array')
    expect(Array.from(pdf)).toEqual([37, 80, 68, 70, 45, 1, 2, 3, 250, 251])
    expect(built.fileCount).toBe(4)
  })
})

describe('secrets', () => {
  it('lists the Ravelry credentials as excluded', () => {
    expect(getBackupExcludedSettingsKeys()).toEqual(expect.arrayContaining(['ravelryUsername', 'ravelryPassword']))
  })

  it('never writes a secret, under any key, anywhere in the archive', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !/\.json$/.test(entry.name)) continue
      const text = await entry.async('string')
      for (const forbidden of [SECRET_USER, SECRET_PASSWORD, 'ravelryUsername', 'ravelryPassword']) {
        expect(text, `${entry.name} leaks ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('fails if a settings field with a sensitive-looking name is not excluded', async () => {
    const settings = (await getSettings()) as unknown as Record<string, unknown>
    const sensitive = /password|passwd|secret|token|api.?key|username|credential/i
    const excluded = new Set(getBackupExcludedSettingsKeys())
    for (const key of Object.keys(settings)) {
      if (sensitive.test(key)) expect(excluded.has(key), `settings.${key} looks sensitive but is not in getBackupExcludedSettingsKeys()`).toBe(true)
    }
  })

  it('drops secrets even from a hand-edited archive', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)
    const data = JSON.parse(await zip.file('data.json')!.async('string'))
    data.settings[0].ravelryPassword = 'planted'
    zip.file('data.json', JSON.stringify(data))
    const opened = await openBackup(await zip.generateAsync({ type: 'blob' }))
    expect(JSON.stringify(opened.tables.settings)).not.toContain('planted')
  })
})

describe('openBackup validation', () => {
  it('refuses a file that is not a zip', async () => {
    await expect(openBackup(new Blob(['nope']))).rejects.toMatchObject({ code: 'not_a_backup' })
  })

  it('refuses a zip without manifest', async () => {
    const zip = new JSZip()
    zip.file('hello.txt', 'x')
    await expect(openBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toMatchObject({ code: 'invalid_manifest' })
  })

  it('refuses a backup from a newer app version with a clear message', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    manifest.schemaVersion = CURRENT_SCHEMA_VERSION + 1
    zip.file('manifest.json', JSON.stringify(manifest))
    const error = await openBackup(await zip.generateAsync({ type: 'blob' })).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BackupError)
    expect((error as BackupError).code).toBe('newer_version')
    expect((error as BackupError).message).toContain('version plus récente')
  })

  it('refuses a truncated backup (count mismatch)', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)
    const data = JSON.parse(await zip.file('data.json')!.async('string'))
    data.counterEvents = []
    zip.file('data.json', JSON.stringify(data))
    await expect(openBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toMatchObject({ code: 'incomplete' })
  })

  it('refuses a backup whose binary file is missing', async () => {
    await seed()
    const { built } = await buildAndOpen()
    const zip = await JSZip.loadAsync(built.blob)
    zip.remove('files/patternFiles/pat1.pdf')
    await expect(openBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toMatchObject({ code: 'incomplete' })
  })

  it('writes nothing while validating', async () => {
    await seed()
    const before = await snapshot()
    await buildAndOpen()
    expect(await snapshot()).toEqual(before)
  })
})

describe('migration of an older backup', () => {
  it('runs the existing upgrades on a schema-v6 backup', async () => {
    const zip = new JSZip()
    zip.file(
      'manifest.json',
      JSON.stringify({ format: 1, schemaVersion: 6, appVersion: null, exportedAt: NOW, counts: { settings: 1, projects: 1 } }),
    )
    zip.file(
      'data.json',
      JSON.stringify({
        settings: [{ ...base('app-settings'), lengthUnit: 'yd', weightUnit: 'g', trackingEnabled: false }],
        projects: [
          {
            ...base('old'), name: 'Vieux', craft: 'knitting', description: '', status: 'done', colorKey: 'rose', notes: '',
            startedAt: null, completedAt: null, targetEndDate: null, lastActivityAt: NOW, activeCounterId: null,
          },
        ],
        // A table that did not exist at v6 must be ignored, not crash.
        guides: [{ ...base('ghost') }],
      }),
    )
    const opened = await openBackup(await zip.generateAsync({ type: 'blob' }))

    expect(opened.migrated).toBe(true)
    const settings = opened.tables.settings[0]!
    expect(settings.lengthUnit).toBe('yd')
    expect(settings.trackingEnabled).toBe(false)
    expect(settings.yarnQuantityUnit).toBe('weight')
    expect(settings.guideRowTextSize).toBe('medium')
    expect(settings.backupReminderEnabled).toBe(true)
    expect(settings.backupReminderIntervalDays).toBe(14)
    expect(opened.tables.projects[0]!.lastWorkTab).toBeNull()
    expect(opened.tables.guides).toHaveLength(0)

    const report = await restoreBackup(opened, 'replace')
    expect(report.added.projects).toBe(1)
    expect((await db.projects.get('old'))?.name).toBe('Vieux')
  })
})

describe('restore: replace all', () => {
  it('rebuilds the database identically, files included, and keeps local Ravelry credentials', async () => {
    await seed()
    const before = await snapshot()
    const { opened } = await buildAndOpen()

    // Diverge: wipe and add unrelated data.
    for (const table of db.tables) await table.clear()
    await getSettings()
    await updateSettings({ ravelryUsername: 'local-user', ravelryPassword: 'local-pass' })
    await db.projects.add({ ...base('other'), name: 'Autre', craft: 'crochet', description: '', status: 'todo', colorKey: 'rose', notes: '', startedAt: null, completedAt: null, targetEndDate: null, lastActivityAt: NOW, activeCounterId: null, lastWorkTab: null })

    const report = await restoreBackup(opened, 'replace')

    expect(report.mode).toBe('replace')
    expect(await db.projects.get('other')).toBeUndefined()
    const after = await snapshot()
    for (const name of BACKUP_TABLES) {
      if (name === 'settings') continue
      expect(after[name], name).toEqual(before[name])
    }
    const settings = await getSettings()
    expect(settings.lengthUnit).toBe('yd')
    expect(settings.ravelryUsername).toBe('local-user')
    expect(settings.ravelryPassword).toBe('local-pass')
    expect(settings.lastBackupAt).toBe(opened.manifest.exportedAt)
  })

  it('leaves current data untouched when the transaction fails', async () => {
    await seed()
    const { opened } = await buildAndOpen()
    await db.projects.update('p1', { name: 'Modifié localement' })
    const before = await snapshot()

    const quota = new DOMException('full', 'QuotaExceededError')
    const spy = vi.spyOn(db.table('patternFiles'), 'bulkAdd').mockRejectedValueOnce(quota)
    const error = await restoreBackup(opened, 'replace').catch((e: unknown) => e)
    spy.mockRestore()

    expect(error).toBeInstanceOf(BackupError)
    expect((error as BackupError).message).toContain('Rien n\'a été modifié')
    expect(await snapshot()).toEqual(before)
  })
})

describe('restore: merge', () => {
  it('adds what is missing and never overwrites existing ids', async () => {
    await seed()
    const { opened } = await buildAndOpen()

    await db.projects.update('p1', { name: 'Modifié localement' })
    await db.counters.update('c1', { value: 99 })
    await db.yarns.delete('y1')
    await db.yarnImages.delete('y1')
    await db.projectYarns.delete('py1')
    // Same pair as a backup link but another id: must not be duplicated.
    await db.projectPatterns.delete('pp1')
    await db.projectPatterns.add({ ...base('pp-local'), projectId: 'p1', patternId: 'pat1', position: 0 })
    await updateSettings({ lengthUnit: 'm' })

    const report = await restoreBackup(opened, 'merge')

    expect((await db.projects.get('p1'))?.name).toBe('Modifié localement')
    expect((await db.counters.get('c1'))?.value).toBe(99)
    expect(await db.yarns.get('y1')).toBeDefined()
    expect(await db.yarnImages.get('y1')).toBeDefined()
    expect(await db.projectYarns.get('py1')).toBeDefined()
    expect(await db.projectPatterns.count()).toBe(1)
    expect((await getSettings()).lengthUnit).toBe('m')
    expect(report.added.yarns).toBe(1)
    expect(report.ignored.projects).toBe(1)
    expect(report.ignored.counters).toBe(1)
    expect(report.ignored.projectPatterns).toBe(1)
  })

  it('ignores the events of a counter that already exists', async () => {
    await seed()
    const { opened } = await buildAndOpen()
    await db.counterEvents.clear()
    const report = await restoreBackup(opened, 'merge')
    expect(await db.counterEvents.count()).toBe(0)
    expect(report.ignored.counterEvents).toBe(1)
  })

  it('reports clearly what was imported when a later group fails', async () => {
    await seed()
    const { opened } = await buildAndOpen()
    for (const table of db.tables) await table.clear()
    await getSettings()

    const spy = vi.spyOn(db.table('projects'), 'bulkAdd').mockRejectedValueOnce(new Error('boom'))
    const error = await restoreBackup(opened, 'merge').catch((e: unknown) => e)
    spy.mockRestore()

    expect(error).toBeInstanceOf(BackupError)
    const message = (error as BackupError).message
    expect(message).toContain('projects')
    expect(message).toContain('Déjà importé')
    expect(await db.yarns.count()).toBe(1)
    expect(await db.projects.count()).toBe(0)
  })
})

describe('backup reminder', () => {
  const now = new Date('2026-03-31T10:00:00.000Z')
  const settings = (patch: Partial<Parameters<typeof getBackupReminderState>[0]['settings']> = {}) => ({
    backupReminderEnabled: true,
    backupReminderIntervalDays: 14 as const,
    lastBackupAt: '2026-03-13T10:00:00.000Z',
    backupReminderSnoozedAt: null,
    ...patch,
  })

  it('is due once the interval has elapsed', () => {
    const state = getBackupReminderState({ settings: settings(), hasData: true, now })
    expect(state).toEqual({ due: true, daysSinceLastBackup: 18 })
  })

  it('is not due within the interval', () => {
    expect(getBackupReminderState({ settings: settings({ lastBackupAt: '2026-03-25T10:00:00.000Z' }), hasData: true, now }).due).toBe(false)
  })

  it('never nags an empty app, nor when disabled or set to never', () => {
    expect(getBackupReminderState({ settings: settings(), hasData: false, now }).due).toBe(false)
    expect(getBackupReminderState({ settings: settings({ backupReminderEnabled: false }), hasData: true, now }).due).toBe(false)
    expect(getBackupReminderState({ settings: settings({ backupReminderIntervalDays: null }), hasData: true, now }).due).toBe(false)
  })

  it('is due when there never was a backup', () => {
    const state = getBackupReminderState({ settings: settings({ lastBackupAt: null }), hasData: true, now })
    expect(state).toEqual({ due: true, daysSinceLastBackup: null })
  })

  it('"Plus tard" waits a full interval from the snooze', () => {
    expect(getBackupReminderState({ settings: settings({ backupReminderSnoozedAt: '2026-03-30T10:00:00.000Z' }), hasData: true, now }).due).toBe(false)
    expect(getBackupReminderState({ settings: settings({ backupReminderSnoozedAt: '2026-03-10T10:00:00.000Z' }), hasData: true, now }).due).toBe(true)
  })

  it('decides once per session', () => {
    resetReminderSessionForTests()
    expect(decideReminderForSession(true)).toBe(true)
    expect(decideReminderForSession(false)).toBe(true)
    resetReminderSessionForTests()
    expect(decideReminderForSession(false)).toBe(false)
    expect(decideReminderForSession(true)).toBe(false)
  })
})
