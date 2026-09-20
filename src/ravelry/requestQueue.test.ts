import { describe, expect, it } from 'vitest'
import { RavelryRequestQueue } from './requestQueue'
import { RavelryError } from './types'

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

describe('RavelryRequestQueue', () => {
  it('cancels a previous, still-pending call when a new one starts', async () => {
    const queue = new RavelryRequestQueue()

    const first = queue.run(async (signal) => {
      await waitForAbort(signal)
      return 'first'
    })
    const firstResult = first.catch((error: unknown) => error)

    const second = queue.run(async () => 'second')

    await expect(second).resolves.toBe('second')
    const outcome = await firstResult
    expect(outcome).toBeInstanceOf(RavelryError)
    expect((outcome as RavelryError).kind).toBe('cancelled')
  })

  it('blocks new calls for a short while after a 429', async () => {
    const queue = new RavelryRequestQueue()
    queue.reportRateLimited()

    expect(queue.isRateLimited()).toBe(true)
    await expect(queue.run(async () => 'should not run')).rejects.toMatchObject({ kind: 'rate_limited' })
  })

  it('is not rate-limited before any 429 has been reported', () => {
    const queue = new RavelryRequestQueue()
    expect(queue.isRateLimited()).toBe(false)
  })
})
