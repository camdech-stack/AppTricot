import { describe, expect, it } from 'vitest'
import { DEFAULT_YARN_FILTERS, filterAndSortYarns, type YarnListItem } from './yarnSearch'
import type { YarnRecord } from './types'

function makeYarn(overrides: Partial<YarnRecord>): YarnRecord {
  return {
    id: overrides.id ?? 'yarn-1',
    name: 'Rios',
    brand: 'Malabrigo',
    line: '',
    colorName: 'Azul',
    colorRef: '150',
    colorFamily: 'bleu',
    weightCategory: 'worsted',
    fiber: '',
    skeinCount: 5,
    metersPerSkein: 192,
    gramsPerSkein: 100,
    dyeLot: '',
    notes: '',
    price: null,
    purchasedAt: null,
    ravelryYarnId: null,
    catalogSource: 'manual',
    ravelryPermalink: null,
    catalogFields: [],
    catalogFetchedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<YarnRecord>, availableSkeins: number | null = 3, linkedProjectIds: string[] = []): YarnListItem {
  return { yarn: makeYarn(overrides), availableSkeins, linkedProjectIds }
}

describe('filterAndSortYarns', () => {
  it('matches the search query against name, brand and color', () => {
    const items = [
      makeItem({ id: 'a', name: 'Rios', brand: 'Malabrigo', colorName: 'Azul' }),
      makeItem({ id: 'b', name: 'Merino', brand: 'Drops', colorName: 'Rouge' }),
    ]
    const result = filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, query: 'azul' }, 'recent')
    expect(result.map((item) => item.yarn.id)).toEqual(['a'])
  })

  it('filters by weight category and color family', () => {
    const items = [
      makeItem({ id: 'a', weightCategory: 'worsted', colorFamily: 'bleu' }),
      makeItem({ id: 'b', weightCategory: 'dk', colorFamily: 'rouge' }),
    ]
    expect(
      filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, weightCategory: 'dk' }, 'recent').map((i) => i.yarn.id),
    ).toEqual(['b'])
    expect(
      filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, colorFamily: 'bleu' }, 'recent').map((i) => i.yarn.id),
    ).toEqual(['a'])
  })

  it('filters by associated project', () => {
    const items = [
      makeItem({ id: 'a' }, 3, ['project-1']),
      makeItem({ id: 'b' }, 3, []),
    ]
    const result = filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, projectId: 'project-1' }, 'recent')
    expect(result.map((item) => item.yarn.id)).toEqual(['a'])
  })

  it('filters by stock state, treating exceeded stock as exhausted', () => {
    const items = [
      makeItem({ id: 'a' }, 2),
      makeItem({ id: 'b' }, 0),
      makeItem({ id: 'c' }, null),
    ]
    expect(
      filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, stockState: 'in_stock' }, 'recent').map((i) => i.yarn.id),
    ).toEqual(['a'])
    expect(
      filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, stockState: 'exhausted' }, 'recent').map((i) => i.yarn.id),
    ).toEqual(['b', 'c'])
  })

  it('filters by minimum meters per skein', () => {
    const items = [makeItem({ id: 'a', metersPerSkein: 200 }), makeItem({ id: 'b', metersPerSkein: 100 })]
    const result = filterAndSortYarns(items, { ...DEFAULT_YARN_FILTERS, minMetersPerSkein: 150 }, 'recent')
    expect(result.map((item) => item.yarn.id)).toEqual(['a'])
  })

  it('sorts by name, brand and available quantity', () => {
    const items = [
      makeItem({ id: 'a', name: 'Zeta', brand: 'B', createdAt: '2024-01-01T00:00:00.000Z' }, 1),
      makeItem({ id: 'b', name: 'Alpha', brand: 'A', createdAt: '2024-01-02T00:00:00.000Z' }, 5),
    ]
    expect(filterAndSortYarns(items, DEFAULT_YARN_FILTERS, 'name').map((i) => i.yarn.id)).toEqual(['b', 'a'])
    expect(filterAndSortYarns(items, DEFAULT_YARN_FILTERS, 'brand').map((i) => i.yarn.id)).toEqual(['b', 'a'])
    expect(filterAndSortYarns(items, DEFAULT_YARN_FILTERS, 'available').map((i) => i.yarn.id)).toEqual(['b', 'a'])
    expect(filterAndSortYarns(items, DEFAULT_YARN_FILTERS, 'recent').map((i) => i.yarn.id)).toEqual(['b', 'a'])
  })
})
