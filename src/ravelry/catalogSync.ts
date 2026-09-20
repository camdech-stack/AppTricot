import { db, nowIso } from '../data'
import type { YarnRecord } from '../data'

// The subset of YarnRecord that a catalog search is allowed to prefill —
// colors, dye lot, skein count, price and photo always stay the user's own
// input (see CLAUDE.md "Modèle de données (étape 3b)").
export type YarnCatalogFieldKey = 'name' | 'brand' | 'line' | 'weightCategory' | 'fiber' | 'metersPerSkein' | 'gramsPerSkein'

export const YARN_CATALOG_FIELD_KEYS: YarnCatalogFieldKey[] = [
  'name',
  'brand',
  'line',
  'weightCategory',
  'fiber',
  'metersPerSkein',
  'gramsPerSkein',
]

export type CatalogFieldSnapshot = Partial<Record<YarnCatalogFieldKey, unknown>>

// At save time: keeps only the fields whose current value still matches the
// snapshot taken when the catalog filled them in. A field the user edited
// since then drops out — the purge below then knows to leave it alone.
export function computeRemainingCatalogFields(
  candidateKeys: YarnCatalogFieldKey[],
  snapshot: CatalogFieldSnapshot,
  current: CatalogFieldSnapshot,
): string[] {
  return candidateKeys.filter((key) => key in snapshot && snapshot[key] === current[key])
}

export function snapshotCatalogFields(source: Record<string, unknown>): CatalogFieldSnapshot {
  const snapshot: CatalogFieldSnapshot = {}
  for (const key of YARN_CATALOG_FIELD_KEYS) {
    if (key in source) snapshot[key] = source[key]
  }
  return snapshot
}

export async function countRavelryYarns(): Promise<number> {
  return db.yarns.filter((yarn) => yarn.catalogSource === 'ravelry').count()
}

// Clears only the fields still listed in catalogFields (the ones the user
// never touched after the catalog filled them in) and the Ravelry-specific
// identifiers, on every yarn sourced from Ravelry. Everything the user
// entered themselves — stock, color, dye lot, photo, notes, price, dates —
// is left untouched. Returns the number of yarns affected, for the
// confirmation dialog.
export async function purgeRavelryData(): Promise<number> {
  return db.transaction('rw', db.yarns, async () => {
    const yarns = await db.yarns.filter((yarn) => yarn.catalogSource === 'ravelry').toArray()
    const now = nowIso()
    for (const yarn of yarns) {
      const cleared: YarnRecord = { ...yarn }
      for (const field of yarn.catalogFields) {
        switch (field as YarnCatalogFieldKey) {
          case 'name':
            cleared.name = 'Fil sans nom'
            break
          case 'brand':
            cleared.brand = ''
            break
          case 'line':
            cleared.line = ''
            break
          case 'fiber':
            cleared.fiber = ''
            break
          case 'weightCategory':
            cleared.weightCategory = null
            break
          case 'metersPerSkein':
            cleared.metersPerSkein = null
            break
          case 'gramsPerSkein':
            cleared.gramsPerSkein = null
            break
        }
      }
      cleared.ravelryYarnId = null
      cleared.ravelryPermalink = null
      cleared.catalogFields = []
      cleared.catalogFetchedAt = null
      cleared.catalogSource = 'manual'
      cleared.updatedAt = now
      await db.yarns.put(cleared)
    }
    return yarns.length
  })
}
