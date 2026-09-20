import type { RavelryCredentials } from './types'

// btoa only accepts Latin1: a password with accents (this app is French)
// would throw. Encoding to UTF-8 bytes first keeps it safe either way.
function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// HTTP Basic auth header for Ravelry's read-only API. Built with btoa, never
// put in a URL — see CLAUDE.md "Contraintes de la licence Ravelry".
export function buildRavelryAuthHeader(credentials: RavelryCredentials): string {
  const token = base64EncodeUtf8(`${credentials.username}:${credentials.password}`)
  return `Basic ${token}`
}
