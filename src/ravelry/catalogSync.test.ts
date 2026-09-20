import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createYarn } from '../data/yarnsRepository'
import { computeRemainingCatalogFields, countRavelryYarns, purgeRavelryData, snapshotCatalogFields } from './catalogSync'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('snapshotCatalogFields / computeRemainingCatalogFields', () => {
  it('keeps only the candidate keys present in the source', () => {
    const snapshot = snapshotCatalogFields({ name: 'Testwool', brand: 'Fictitious Fibers', colorName: 'ignored' })
    expect(snapshot).toEqual({ name: 'Testwool', brand: 'Fictitious Fibers' })
  })

  it('drops a field the user edited after the prefill, keeps the untouched ones', () => {
    const baseline = { name: 'Testwool', brand: 'Fictitious Fibers', gramsPerSkein: 100 }
    const edited = { name: 'Testwool (renamed)', brand: 'Fictitious Fibers', gramsPerSkein: 100 }
    const remaining = computeRemainingCatalogFields(['name', 'brand', 'gramsPerSkein'], baseline, edited)
    expect(remaining).toEqual(['brand', 'gramsPerSkein'])
  })
})

describe('countRavelryYarns / purgeRavelryData', () => {
  it('only clears fields still listed in catalogFields, keeps personal data intact', async () => {
    const yarn = await createYarn({
      name: 'Testwool Fictif',
      brand: 'Fictitious Fibers Co.',
      line: 'Basic',
      fiber: '100 % laine fictive',
      weightCategory: 'worsted',
      metersPerSkein: 200,
      gramsPerSkein: 100,
      colorName: 'Bleu profond (saisi à la main)',
      skeinCount: 4,
      notes: 'Notes personnelles',
      ravelryYarnId: 'fictitious-1',
      ravelryPermalink: 'https://www.ravelry.com/yarns/library/fictitious-1',
      catalogSource: 'ravelry',
      catalogFields: ['name', 'brand', 'fiber'],
      catalogFetchedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(await countRavelryYarns()).toBe(1)

    const affected = await purgeRavelryData()
    expect(affected).toBe(1)

    const cleared = await db.yarns.get(yarn.id)
    expect(cleared?.name).toBe('Fil sans nom')
    expect(cleared?.brand).toBe('')
    expect(cleared?.fiber).toBe('')
    // Not in catalogFields, so untouched by the purge.
    expect(cleared?.line).toBe('Basic')
    expect(cleared?.weightCategory).toBe('worsted')
    expect(cleared?.metersPerSkein).toBe(200)
    expect(cleared?.gramsPerSkein).toBe(100)
    // Always cleared regardless of catalogFields.
    expect(cleared?.ravelryYarnId).toBeNull()
    expect(cleared?.ravelryPermalink).toBeNull()
    expect(cleared?.catalogFields).toEqual([])
    expect(cleared?.catalogFetchedAt).toBeNull()
    expect(cleared?.catalogSource).toBe('manual')
    // Never touched: the user's own data.
    expect(cleared?.colorName).toBe('Bleu profond (saisi à la main)')
    expect(cleared?.skeinCount).toBe(4)
    expect(cleared?.notes).toBe('Notes personnelles')

    expect(await countRavelryYarns()).toBe(0)
  })

  it('leaves manual yarns untouched', async () => {
    await createYarn({ name: 'Fil manuel', catalogSource: 'manual' })
    const affected = await purgeRavelryData()
    expect(affected).toBe(0)
  })
})
