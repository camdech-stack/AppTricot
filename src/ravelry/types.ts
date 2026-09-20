import type { YarnWeightCategory } from '../data'

export interface RavelryCredentials {
  username: string
  password: string
}

// What went wrong with a Ravelry call — drives both the settings "test
// connection" result and the search sheet's error message. Never carries
// the credentials themselves.
export type RavelryErrorKind =
  | 'invalid_credentials' // 401/403
  | 'rate_limited' // 429
  | 'service_unavailable' // 503/504
  | 'network_unreachable' // offline, blocked by CORS, or timed out
  | 'unexpected_response' // not JSON, or a shape we can't make sense of
  | 'cancelled' // superseded by a newer request — never shown to the user

export class RavelryError extends Error {
  readonly kind: RavelryErrorKind
  // The raw HTTP status, when there was one (absent for network/timeout/CORS
  // failures) — used only for the hidden diagnostic screen.
  readonly status: number | null

  constructor(kind: RavelryErrorKind, status: number | null = null) {
    super(`RavelryError: ${kind}`)
    this.kind = kind
    this.status = status
  }
}

// One row in the search results list — text only, per Ravelry's license
// (see CLAUDE.md): no photos, no descriptions, no reviews.
export interface YarnCatalogSearchResult {
  id: string
  name: string
  brand: string
  weightCategoryLabel: string
  metersPerSkein: number | null
  gramsPerSkein: number | null
}

export interface YarnCatalogSearchPage {
  results: YarnCatalogSearchResult[]
  hasMore: boolean
}

// The mapped detail used to prefill the yarn form. Field names match the
// subset of YarnDraft that step 3b is allowed to prefill — colors, dye lot
// and skein count stay the user's own input (see CLAUDE.md).
export interface YarnCatalogDetail {
  id: string
  name: string
  brand: string
  line: string
  weightCategory: YarnWeightCategory | null
  fiber: string
  metersPerSkein: number | null
  gramsPerSkein: number | null
  permalink: string | null
}
