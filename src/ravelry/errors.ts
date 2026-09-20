import type { RavelryErrorKind } from './types'

export function classifyRavelryStatus(status: number): RavelryErrorKind {
  if (status === 401 || status === 403) return 'invalid_credentials'
  if (status === 429) return 'rate_limited'
  if (status === 503 || status === 504) return 'service_unavailable'
  return 'unexpected_response'
}

// French, user-facing message for each error kind — never interpolates the
// credentials or the raw response into the text.
export function describeRavelryError(kind: RavelryErrorKind): string {
  switch (kind) {
    case 'invalid_credentials':
      return 'Identifiants refusés par Ravelry. Vérifiez-les dans les Réglages.'
    case 'rate_limited':
      return 'Trop de requêtes envoyées à Ravelry. Réessayez dans un instant.'
    case 'service_unavailable':
      return 'Le service Ravelry est indisponible pour le moment.'
    case 'network_unreachable':
      return 'Impossible de joindre Ravelry (hors ligne ou requête bloquée).'
    case 'unexpected_response':
      return 'Réponse inattendue de Ravelry.'
    case 'cancelled':
      return ''
  }
}
