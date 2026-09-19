import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

// Keeps the screen on while `active` (the counter screen is open). Support
// is inconsistent (notably iOS Safari, to confirm) — any failure is
// swallowed and the app just falls back to the normal auto-lock behavior.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLockCandidate = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock
    if (!active || !wakeLockCandidate) return
    const wakeLock = wakeLockCandidate

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    async function acquire() {
      try {
        sentinel = await wakeLock.request('screen')
      } catch {
        // Unsupported, refused, or backgrounded: fail silently.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !cancelled) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}
