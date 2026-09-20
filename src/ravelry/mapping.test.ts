import { describe, expect, it } from 'vitest'
import { mapSearchResponse, mapSearchResultItem, mapWeightCategoryLabel, mapYarnDetail } from './mapping'

// Every fixture below is invented for this test suite — no real Ravelry
// data, per CLAUDE.md.

describe('mapWeightCategoryLabel', () => {
  it('maps known Ravelry labels to the app enum', () => {
    expect(mapWeightCategoryLabel('Lace')).toBe('dentelle')
    expect(mapWeightCategoryLabel('Fingering')).toBe('chaussettes')
    expect(mapWeightCategoryLabel('Light Fingering')).toBe('chaussettes')
    expect(mapWeightCategoryLabel('Sock')).toBe('chaussettes')
    expect(mapWeightCategoryLabel('Sport')).toBe('sport')
    expect(mapWeightCategoryLabel('DK')).toBe('dk')
    expect(mapWeightCategoryLabel('Worsted')).toBe('worsted')
    expect(mapWeightCategoryLabel('Aran')).toBe('aran')
    expect(mapWeightCategoryLabel('Bulky')).toBe('bulky')
    expect(mapWeightCategoryLabel('Super Bulky')).toBe('super_bulky')
    expect(mapWeightCategoryLabel('Jumbo')).toBe('super_bulky')
  })

  it('falls back to autre for an unrecognized label, and null when absent', () => {
    expect(mapWeightCategoryLabel('Some Made-Up Weight')).toBe('autre')
    expect(mapWeightCategoryLabel(undefined)).toBeNull()
  })
})

describe('mapSearchResultItem', () => {
  it('converts yardage to meters, rounded', () => {
    const item = mapSearchResultItem({
      id: 'fictitious-1',
      name: 'Testwool Fictif',
      yarn_company_name: 'Fictitious Fibers Co.',
      yarn_weight: { name: 'Worsted' },
      yardage: 220,
      grams: 100,
    })
    expect(item).not.toBeNull()
    // 220 yards * 0.9144 = 201.168 -> rounds to 201.
    expect(item?.metersPerSkein).toBe(201)
    expect(item?.gramsPerSkein).toBe(100)
    expect(item?.brand).toBe('Fictitious Fibers Co.')
    expect(item?.weightCategoryLabel).toBe('Worsted')
  })

  it('tolerates missing optional fields without throwing', () => {
    const item = mapSearchResultItem({ id: 'fictitious-2', name: 'Bare Bones Yarn' })
    expect(item).toEqual({
      id: 'fictitious-2',
      name: 'Bare Bones Yarn',
      brand: '',
      weightCategoryLabel: '',
      metersPerSkein: null,
      gramsPerSkein: null,
    })
  })

  it('returns null (never throws) when required identity fields are missing', () => {
    expect(mapSearchResultItem({ name: 'No id' })).toBeNull()
    expect(mapSearchResultItem(null)).toBeNull()
    expect(mapSearchResultItem('not an object')).toBeNull()
  })
})

describe('mapSearchResponse', () => {
  it('maps a page of invented results and flags hasMore from the page size', () => {
    const page = mapSearchResponse(
      { yarns: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] },
      2,
    )
    expect(page.results).toHaveLength(2)
    expect(page.hasMore).toBe(true)
  })

  it('tolerates a missing yarns list', () => {
    expect(mapSearchResponse({}, 20)).toEqual({ results: [], hasMore: false })
    expect(mapSearchResponse(undefined, 20)).toEqual({ results: [], hasMore: false })
  })
})

describe('mapYarnDetail', () => {
  it('builds a composition string from a fiber list with percentages', () => {
    const detail = mapYarnDetail({
      yarn: {
        id: 'fictitious-3',
        name: 'Fictional Merino Blend',
        yarn_company_name: 'Fictitious Fibers Co.',
        yarn_weight: { name: 'DK' },
        yardage: 100,
        grams: 50,
        yarn_fibers: [
          { fiber_type: { name: 'Laine' }, percentage: 80 },
          { fiber_type: { name: 'Polyamide' }, percentage: 20 },
        ],
        permalink: 'fictitious-fibers-co/fictional-merino-blend',
      },
    })
    expect(detail).not.toBeNull()
    expect(detail?.fiber).toBe('80 % laine, 20 % polyamide')
    expect(detail?.weightCategory).toBe('dk')
    expect(detail?.permalink).toBe('https://www.ravelry.com/yarns/library/fictitious-fibers-co/fictional-merino-blend')
  })

  it('falls back to a plain composition string when there is no fiber list', () => {
    const detail = mapYarnDetail({ yarn: { id: 'fictitious-4', name: 'Mystery Yarn', fiber_content: '100% acrylique' } })
    expect(detail?.fiber).toBe('100% acrylique')
  })

  it('tolerates a missing fiber field entirely, and an unknown weight category', () => {
    const detail = mapYarnDetail({ yarn: { id: 'fictitious-5', name: 'No Fiber Info', yarn_weight: { name: 'Mystery Weight' } } })
    expect(detail?.fiber).toBe('')
    expect(detail?.weightCategory).toBe('autre')
    expect(detail?.line).toBe('')
    expect(detail?.permalink).toBeNull()
  })

  it('returns null when the response has no identifiable yarn', () => {
    expect(mapYarnDetail({})).toBeNull()
    expect(mapYarnDetail(null)).toBeNull()
  })
})
