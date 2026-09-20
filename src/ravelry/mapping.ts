import { yardsToMeters } from '../data'
import type { YarnWeightCategory } from '../data'
import type { YarnCatalogDetail, YarnCatalogSearchPage, YarnCatalogSearchResult } from './types'

// Ravelry's exact response schema isn't documented anywhere we have access
// to, so every read below is defensive: unknown shape, optional nesting,
// several possible field names. Nothing here throws on a missing field —
// see CLAUDE.md "Modèle de données (étape 3b)" and the diagnostic screen
// (/#/diagnostic-ravelry) for reporting a field that turns out to be
// mismapped once we see real responses.
type Json = Record<string, unknown> | null | undefined

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number') return String(value)
  return undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

// Reads a dot path ("yarn_weight.name") from a loosely-typed object,
// tolerating any missing segment along the way.
function readPath(obj: Json, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = obj
  for (const segment of segments) {
    const record = asRecord(current)
    if (!record) return undefined
    current = record[segment]
  }
  return current
}

function pickString(obj: Json, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = asString(readPath(obj, path))
    if (value !== undefined) return value
  }
  return undefined
}

function pickNumber(obj: Json, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = asNumber(readPath(obj, path))
    if (value !== undefined) return value
  }
  return undefined
}

// Ravelry yardage is (very likely) in yards — see CLAUDE.md. Converts to
// meters and rounds to the nearest whole meter; stays null when no yardage
// field is present at all.
function pickMetersPerSkein(obj: Json): number | null {
  const yards = pickNumber(obj, ['yardage', 'yardage_max', 'yardage_min', 'yarn.yardage'])
  if (yards === undefined) return null
  return Math.round(yardsToMeters(yards))
}

function pickGramsPerSkein(obj: Json): number | null {
  const grams = pickNumber(obj, ['grams', 'grams_max', 'grams_min', 'weight'])
  return grams ?? null
}

const WEIGHT_CATEGORY_KEYWORDS: [YarnWeightCategory, string[]][] = [
  ['dentelle', ['lace', 'cobweb', 'thread']],
  ['chaussettes', ['fingering', 'sock', 'light fingering']],
  ['sport', ['sport']],
  ['dk', ['dk', 'double knitting', 'light worsted']],
  ['worsted', ['worsted', 'aran weight worsted']],
  ['aran', ['aran']],
  ['super_bulky', ['super bulky', 'jumbo']],
  ['bulky', ['bulky']],
]

// Maps Ravelry's free-text weight category label to the app's enum — see
// CLAUDE.md for the exact mapping table. Falls back to 'autre' for anything
// unrecognized rather than guessing.
export function mapWeightCategoryLabel(label: string | undefined): YarnWeightCategory | null {
  if (!label) return null
  const normalized = label.toLowerCase()
  for (const [category, keywords] of WEIGHT_CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return category
  }
  return 'autre'
}

function pickWeightCategoryLabel(obj: Json): string | undefined {
  return pickString(obj, ['yarn_weight.name', 'yarn_weight.name_alt', 'weight_category', 'weight.name'])
}

// Builds "80 % laine, 20 % polyamide" from a fiber list, or falls back to a
// plain composition string if that's all the response offers.
function pickComposition(obj: Json): string {
  const fibers = readPath(obj, 'yarn_fibers') ?? readPath(obj, 'fibers') ?? readPath(obj, 'fiber_content')
  if (Array.isArray(fibers)) {
    const parts = fibers
      .map((entry) => {
        const record = asRecord(entry)
        if (!record) return undefined
        const name = pickString(record, ['fiber_type.name', 'fiber.name', 'name'])
        const percentage = pickNumber(record, ['percentage', 'percent'])
        if (!name) return undefined
        return percentage !== undefined ? `${Math.round(percentage)} % ${name.toLowerCase()}` : name
      })
      .filter((part): part is string => Boolean(part))
    if (parts.length > 0) return parts.join(', ')
  }
  const plain = asString(fibers)
  return plain ?? ''
}

function pickPermalink(obj: Json): string | null {
  const absolute = pickString(obj, ['permalink_url', 'url'])
  if (absolute?.startsWith('http')) return absolute
  const slug = pickString(obj, ['permalink'])
  if (!slug) return null
  return `https://www.ravelry.com/yarns/library/${slug}`
}

export function mapSearchResultItem(raw: unknown): YarnCatalogSearchResult | null {
  const record = asRecord(raw)
  const id = pickString(record, ['id'])
  const name = pickString(record, ['name'])
  if (!id || !name) return null

  return {
    id,
    name,
    brand: pickString(record, ['yarn_company_name', 'yarn_company.name', 'company_name']) ?? '',
    weightCategoryLabel: pickWeightCategoryLabel(record) ?? '',
    metersPerSkein: pickMetersPerSkein(record),
    gramsPerSkein: pickGramsPerSkein(record),
  }
}

// Maps GET /yarns/search.json — an object with a "yarns" list. Ravelry
// paginates with page/page_size; we treat "a full page came back" as a
// tolerant proxy for "there might be more" since the exact total-count
// field is unconfirmed (see module doc comment).
export function mapSearchResponse(raw: unknown, pageSize: number): YarnCatalogSearchPage {
  const record = asRecord(raw)
  const list = record?.yarns
  const items = Array.isArray(list) ? list : []
  const results = items.map(mapSearchResultItem).filter((item): item is YarnCatalogSearchResult => item !== null)
  return { results, hasMore: results.length >= pageSize }
}

// Maps GET /yarns/{id}.json — an object with a "yarn" object.
export function mapYarnDetail(raw: unknown): YarnCatalogDetail | null {
  const record = asRecord(raw)
  const yarn = asRecord(record?.yarn) ?? record
  const id = pickString(yarn, ['id'])
  const name = pickString(yarn, ['name'])
  if (!id || !name) return null

  return {
    id,
    name,
    brand: pickString(yarn, ['yarn_company_name', 'yarn_company.name', 'company_name']) ?? '',
    line: pickString(yarn, ['yarn_range', 'family', 'line']) ?? '',
    weightCategory: mapWeightCategoryLabel(pickWeightCategoryLabel(yarn)),
    fiber: pickComposition(yarn),
    metersPerSkein: pickMetersPerSkein(yarn),
    gramsPerSkein: pickGramsPerSkein(yarn),
    permalink: pickPermalink(yarn),
  }
}
