import type { YarnColorFamily, YarnRecord, YarnWeightCategory } from './types'

export type YarnSortOption = 'recent' | 'name' | 'brand' | 'available'

export interface YarnListFilters {
  query: string
  weightCategory: YarnWeightCategory | 'all'
  colorFamily: YarnColorFamily | 'all'
  projectId: string | 'all'
  stockState: 'all' | 'in_stock' | 'exhausted'
  minMetersPerSkein: number | null
}

export const DEFAULT_YARN_FILTERS: YarnListFilters = {
  query: '',
  weightCategory: 'all',
  colorFamily: 'all',
  projectId: 'all',
  stockState: 'all',
  minMetersPerSkein: null,
}

// One row of context per yarn, precomputed by the caller (availableSkeins
// from yarnMath, linkedProjectIds from projectYarns) so this stays a pure
// function over plain data — no Dexie access here.
export interface YarnListItem {
  yarn: YarnRecord
  availableSkeins: number | null
  linkedProjectIds: string[]
}

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

function matchesQuery(yarn: YarnRecord, query: string): boolean {
  if (!query) return true
  const needle = normalize(query)
  return [yarn.name, yarn.brand, yarn.colorName, yarn.colorRef].some((field) => normalize(field).includes(needle))
}

export function filterAndSortYarns(items: YarnListItem[], filters: YarnListFilters, sort: YarnSortOption): YarnListItem[] {
  const filtered = items.filter(({ yarn, availableSkeins, linkedProjectIds }) => {
    if (!matchesQuery(yarn, filters.query)) return false
    if (filters.weightCategory !== 'all' && yarn.weightCategory !== filters.weightCategory) return false
    if (filters.colorFamily !== 'all' && yarn.colorFamily !== filters.colorFamily) return false
    if (filters.projectId !== 'all' && !linkedProjectIds.includes(filters.projectId)) return false
    // availableSkeins is null only when stock is already exceeded (see
    // computeYarnStockSummary), which counts as exhausted, not in stock.
    if (filters.stockState === 'in_stock' && !(availableSkeins !== null && availableSkeins > 0)) return false
    if (filters.stockState === 'exhausted' && !(availableSkeins === null || availableSkeins <= 0)) return false
    if (filters.minMetersPerSkein !== null && (yarn.metersPerSkein ?? 0) < filters.minMetersPerSkein) return false
    return true
  })

  const sorted = filtered.slice()
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => a.yarn.name.localeCompare(b.yarn.name))
      break
    case 'brand':
      sorted.sort((a, b) => a.yarn.brand.localeCompare(b.yarn.brand) || a.yarn.name.localeCompare(b.yarn.name))
      break
    case 'available':
      sorted.sort((a, b) => (b.availableSkeins ?? -Infinity) - (a.availableSkeins ?? -Infinity))
      break
    case 'recent':
    default:
      sorted.sort((a, b) => b.yarn.createdAt.localeCompare(a.yarn.createdAt))
      break
  }
  return sorted
}
