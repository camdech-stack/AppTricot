import type { PatternRecord, ProjectCraft } from './types'

export type PatternSortOption = 'recent' | 'name' | 'lastOpened'

export interface PatternListFilters {
  query: string
  craft: ProjectCraft | 'all'
  tag: string | 'all'
  linked: 'all' | 'linked' | 'unlinked'
}

export const DEFAULT_PATTERN_FILTERS: PatternListFilters = {
  query: '',
  craft: 'all',
  tag: 'all',
  linked: 'all',
}

// One row of context per pattern, precomputed by the caller (which projects
// link it) so this stays a pure function over plain data — no Dexie access
// here, same convention as yarnSearch.ts.
export interface PatternListItem {
  pattern: PatternRecord
  linkedProjectIds: string[]
}

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

function matchesQuery(pattern: PatternRecord, query: string): boolean {
  if (!query) return true
  const needle = normalize(query)
  if (normalize(pattern.name).includes(needle)) return true
  if (normalize(pattern.source).includes(needle)) return true
  if (normalize(pattern.notes).includes(needle)) return true
  return pattern.tags.some((tag) => normalize(tag).includes(needle))
}

export function filterAndSortPatterns(
  items: PatternListItem[],
  filters: PatternListFilters,
  sort: PatternSortOption,
): PatternListItem[] {
  const filtered = items.filter(({ pattern, linkedProjectIds }) => {
    if (!matchesQuery(pattern, filters.query)) return false
    if (filters.craft !== 'all' && pattern.craft !== filters.craft) return false
    if (filters.tag !== 'all' && !pattern.tags.includes(filters.tag)) return false
    if (filters.linked === 'linked' && linkedProjectIds.length === 0) return false
    if (filters.linked === 'unlinked' && linkedProjectIds.length > 0) return false
    return true
  })

  const sorted = filtered.slice()
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => a.pattern.name.localeCompare(b.pattern.name))
      break
    case 'lastOpened':
      sorted.sort((a, b) => (b.pattern.lastOpenedAt ?? '').localeCompare(a.pattern.lastOpenedAt ?? ''))
      break
    case 'recent':
    default:
      sorted.sort((a, b) => b.pattern.createdAt.localeCompare(a.pattern.createdAt))
      break
  }
  return sorted
}
