import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchYarnsCatalog, testRavelryConnection } from './client'
import { RavelryRequestQueue } from './requestQueue'
import { RavelryError } from './types'

const CREDENTIALS = { username: 'fictitious-user', password: 'fictitious-pass' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// A fresh queue per test: the min-gap spacing and 429 lockout are
// per-instance state (see requestQueue.test.ts), and sharing the app-wide
// singleton across these tests would make one test's 429 block the next.
function freshQueue(): RavelryRequestQueue {
  return new RavelryRequestQueue()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchYarnsCatalog error classification', () => {
  it.each([
    [401, 'invalid_credentials'],
    [403, 'invalid_credentials'],
    [429, 'rate_limited'],
    [503, 'service_unavailable'],
    [504, 'service_unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status })),
    )
    await expect(searchYarnsCatalog('wool', 1, CREDENTIALS, freshQueue())).rejects.toMatchObject({ kind })
  })

  it('maps a rejected fetch (offline or CORS-blocked) to network_unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(searchYarnsCatalog('wool', 1, CREDENTIALS, freshQueue())).rejects.toMatchObject({ kind: 'network_unreachable' })
  })

  it('maps a non-JSON response to unexpected_response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>not json</html>', { status: 200, headers: { 'content-type': 'text/html' } })),
    )
    await expect(searchYarnsCatalog('wool', 1, CREDENTIALS, freshQueue())).rejects.toMatchObject({ kind: 'unexpected_response' })
  })

  it('never includes the credentials in the thrown error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )
    try {
      await searchYarnsCatalog('wool', 1, CREDENTIALS, freshQueue())
      throw new Error('expected a rejection')
    } catch (error) {
      const serialized = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error)
      expect(serialized).not.toContain(CREDENTIALS.username)
      expect(serialized).not.toContain(CREDENTIALS.password)
    }
  })

  it('sends the query on api.ravelry.com with a Basic auth header, no credentials in the URL', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(200, { yarns: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await searchYarnsCatalog('mohair', 1, CREDENTIALS, freshQueue())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toMatch(/^https:\/\/api\.ravelry\.com\/yarns\/search\.json\?/)
    expect(url).not.toContain(CREDENTIALS.username)
    expect(url).not.toContain(CREDENTIALS.password)
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Basic /)
  })
})

describe('testRavelryConnection', () => {
  it('resolves on a well-formed JSON reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { yarns: [] })),
    )
    await expect(testRavelryConnection(CREDENTIALS, freshQueue())).resolves.toBeUndefined()
  })

  it('rejects with invalid_credentials on a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )
    await expect(testRavelryConnection(CREDENTIALS, freshQueue())).rejects.toBeInstanceOf(RavelryError)
  })
})
