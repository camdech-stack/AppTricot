import { describe, expect, it } from 'vitest'
import { DEFAULT_PATTERN_FILTERS, filterAndSortPatterns, type PatternListItem } from './patternSearch'
import type { PatternRecord } from './types'

function makePattern(overrides: Partial<PatternRecord>): PatternRecord {
  return {
    id: overrides.id ?? 'pattern-1',
    name: 'Pull torsades',
    craft: 'knitting',
    tags: [],
    source: '',
    notes: '',
    pageCount: 10,
    sizeBytes: 1000,
    fileName: 'pull.pdf',
    fileHash: 'hash',
    fileVersion: 1,
    fileUpdatedAt: '2024-01-01T00:00:00.000Z',
    lastOpenedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function item(pattern: PatternRecord, linkedProjectIds: string[] = []): PatternListItem {
  return { pattern, linkedProjectIds }
}

describe('filterAndSortPatterns', () => {
  const pull = makePattern({ id: 'pull', name: 'Pull torsades', tags: ['hiver', 'adulte'], craft: 'knitting' })
  const chaussettes = makePattern({
    id: 'chaussettes',
    name: 'Chaussettes rayées',
    tags: ['rapide'],
    craft: 'crochet',
    source: 'Ravelry',
  })
  const items = [item(pull, ['project-1']), item(chaussettes)]

  it('matches by name, tags, source or notes', () => {
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, query: 'torsades' }, 'recent')).toEqual([item(pull, ['project-1'])])
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, query: 'rapide' }, 'recent')).toEqual([item(chaussettes)])
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, query: 'ravelry' }, 'recent')).toEqual([item(chaussettes)])
  })

  it('filters by craft', () => {
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, craft: 'crochet' }, 'recent')).toEqual([item(chaussettes)])
  })

  it('filters by tag', () => {
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, tag: 'hiver' }, 'recent')).toEqual([item(pull, ['project-1'])])
  })

  it('filters by linked-to-a-project state', () => {
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, linked: 'linked' }, 'recent')).toEqual([item(pull, ['project-1'])])
    expect(filterAndSortPatterns(items, { ...DEFAULT_PATTERN_FILTERS, linked: 'unlinked' }, 'recent')).toEqual([item(chaussettes)])
  })

  it('sorts by name', () => {
    const sorted = filterAndSortPatterns(items, DEFAULT_PATTERN_FILTERS, 'name')
    expect(sorted.map((entry) => entry.pattern.name)).toEqual(['Chaussettes rayées', 'Pull torsades'])
  })

  it('sorts by last opened, most recent first, unopened last', () => {
    const opened = makePattern({ id: 'opened', name: 'Bonnet', lastOpenedAt: '2024-06-01T00:00:00.000Z' })
    const neverOpened = makePattern({ id: 'never', name: 'Écharpe', lastOpenedAt: null })
    const sorted = filterAndSortPatterns([item(neverOpened), item(opened)], DEFAULT_PATTERN_FILTERS, 'lastOpened')
    expect(sorted.map((entry) => entry.pattern.id)).toEqual(['opened', 'never'])
  })
})
