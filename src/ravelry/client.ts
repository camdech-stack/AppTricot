import { buildRavelryAuthHeader } from './auth'
import { classifyRavelryStatus } from './errors'
import { mapSearchResponse, mapYarnDetail } from './mapping'
import { ravelryRequestQueue, type RavelryRequestQueue } from './requestQueue'
import { RavelryError, type RavelryCredentials, type YarnCatalogDetail, type YarnCatalogSearchPage } from './types'

const API_BASE = 'https://api.ravelry.com'
export const RAVELRY_SEARCH_PAGE_SIZE = 20

// A single low-level call to the Ravelry API: builds the Basic-auth header,
// requires a JSON response, and never lets a network/CORS failure or an
// unexpected shape throw anything but a RavelryError. `path` never includes
// the credentials — only the Authorization header does.
async function ravelryGet(
  path: string,
  credentials: RavelryCredentials,
  signal: AbortSignal,
  queue: RavelryRequestQueue,
): Promise<{ status: number; data: unknown }> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: buildRavelryAuthHeader(credentials),
        Accept: 'application/json',
      },
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    // A CORS block or an offline network surfaces as a generic fetch
    // rejection with no status — see CLAUDE.md "réponse bloquée par CORS".
    throw new RavelryError('network_unreachable')
  }

  if (!response.ok) {
    if (response.status === 429) queue.reportRateLimited()
    throw new RavelryError(classifyRavelryStatus(response.status), response.status)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new RavelryError('unexpected_response', response.status)
  }

  try {
    return { status: response.status, data: await response.json() }
  } catch {
    throw new RavelryError('unexpected_response', response.status)
  }
}

export interface LastRavelryCall {
  path: string
  status: number | null
  topLevelFields: { name: string; type: string }[]
  firstResultFields: { name: string; type: string }[]
  mappedResult: unknown
}

let lastCall: LastRavelryCall | null = null

// Read by the hidden diagnostic screen only — nothing here is persisted.
export function getLastRavelryCall(): LastRavelryCall | null {
  return lastCall
}

function describeFields(value: unknown): { name: string; type: string }[] {
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).map(([name, fieldValue]) => ({
    name,
    type: Array.isArray(fieldValue) ? 'array' : fieldValue === null ? 'null' : typeof fieldValue,
  }))
}

function recordDiagnostic(path: string, status: number | null, raw: unknown, mapped: unknown, firstItem: unknown) {
  lastCall = {
    path,
    status,
    topLevelFields: describeFields(raw),
    firstResultFields: describeFields(firstItem),
    mappedResult: mapped,
  }
}

// `queue` defaults to the shared app-wide singleton; tests pass a fresh
// instance so they don't share the min-gap/rate-limit state with each other.
export async function searchYarnsCatalog(
  query: string,
  page: number,
  credentials: RavelryCredentials,
  queue: RavelryRequestQueue = ravelryRequestQueue,
): Promise<YarnCatalogSearchPage> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    page_size: String(RAVELRY_SEARCH_PAGE_SIZE),
    sort: 'best',
  })
  const path = `/yarns/search.json?${params.toString()}`
  return queue.run(async (signal) => {
    try {
      const { status, data } = await ravelryGet(path, credentials, signal, queue)
      const mapped = mapSearchResponse(data, RAVELRY_SEARCH_PAGE_SIZE)
      const rawList = (data as { yarns?: unknown[] } | undefined)?.yarns
      recordDiagnostic(path, status, data, mapped, Array.isArray(rawList) ? rawList[0] : undefined)
      return mapped
    } catch (error) {
      recordDiagnostic(path, error instanceof RavelryError ? error.status : null, undefined, undefined, undefined)
      throw error
    }
  })
}

export async function getYarnCatalogDetail(
  id: string,
  credentials: RavelryCredentials,
  queue: RavelryRequestQueue = ravelryRequestQueue,
): Promise<YarnCatalogDetail | null> {
  const path = `/yarns/${encodeURIComponent(id)}.json`
  return queue.run(async (signal) => {
    try {
      const { status, data } = await ravelryGet(path, credentials, signal, queue)
      const mapped = mapYarnDetail(data)
      recordDiagnostic(path, status, data, mapped, (data as { yarn?: unknown } | undefined)?.yarn)
      return mapped
    } catch (error) {
      recordDiagnostic(path, error instanceof RavelryError ? error.status : null, undefined, undefined, undefined)
      throw error
    }
  })
}

// Read-only credential check for the settings "Tester la connexion" button —
// any successful, well-formed JSON reply is treated as "connected".
export async function testRavelryConnection(
  credentials: RavelryCredentials,
  queue: RavelryRequestQueue = ravelryRequestQueue,
): Promise<void> {
  const path = '/yarns/search.json?query=wool&page=1&page_size=1'
  await queue.run(async (signal) => {
    await ravelryGet(path, credentials, signal, queue)
  })
}
