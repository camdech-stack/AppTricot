import { RavelryError } from './types'

const MIN_GAP_MS = 1000
const TIMEOUT_MS = 10_000
// How long a 429 blocks new searches — "bloque brièvement les nouvelles
// recherches" (see task spec), not a full backoff strategy.
const RATE_LIMIT_LOCKOUT_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Serializes every Ravelry call from the app: at most one in flight (a new
// call aborts the previous one), at least MIN_GAP_MS between two request
// starts, and a short lockout after a 429. One instance is shared app-wide
// (see the singleton export below) so the search sheet and the diagnostic
// screen never race each other.
export class RavelryRequestQueue {
  private currentController: AbortController | null = null
  private lastRequestStartedAt = 0
  private rateLimitedUntil = 0

  isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil
  }

  reportRateLimited(): void {
    this.rateLimitedUntil = Date.now() + RATE_LIMIT_LOCKOUT_MS
  }

  // Runs `task` with a fresh AbortSignal that: aborts any previous call from
  // this queue, times out after 10s, and is itself abortable if a newer
  // call comes in while this one is still waiting out the min-gap delay.
  async run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.isRateLimited()) {
      throw new RavelryError('rate_limited')
    }

    this.currentController?.abort()
    const controller = new AbortController()
    this.currentController = controller

    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - this.lastRequestStartedAt))
    if (wait > 0) {
      await sleep(wait)
    }
    if (controller.signal.aborted) {
      throw new RavelryError('cancelled')
    }

    this.lastRequestStartedAt = Date.now()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      return await task(controller.signal)
    } catch (error) {
      if (controller.signal.aborted) {
        // Distinguish "we timed out" from "a newer request superseded us":
        // only the latter should be silently ignored by the caller.
        throw new RavelryError(this.currentController === controller ? 'network_unreachable' : 'cancelled')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
      if (this.currentController === controller) {
        this.currentController = null
      }
    }
  }
}

export const ravelryRequestQueue = new RavelryRequestQueue()
