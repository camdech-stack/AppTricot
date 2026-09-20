import { useEffect } from 'react'
import { closeOrphanSessions, handleForegroundLoss, touchHeartbeat } from '../data'

const HEARTBEAT_INTERVAL_MS = 10_000

// Mounted once at the app root (see App.tsx): owns the part of the session
// lifecycle that isn't tied to any particular screen — orphan recovery on
// launch/foreground return, ending the live session when the app leaves the
// foreground, and the reliability heartbeat. See CLAUDE.md, "Suivi du
// temps" > "Fiabilité".
export function useSessionTracking(): void {
  useEffect(() => {
    void closeOrphanSessions()

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void handleForegroundLoss()
      } else {
        void closeOrphanSessions()
      }
    }

    function handlePageHide() {
      void handleForegroundLoss()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    // Recovery-only heartbeat: no-ops when nothing is live, never used as
    // an inactivity timeout (see recordActivity/touchHeartbeat).
    const heartbeat = window.setInterval(() => {
      void touchHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.clearInterval(heartbeat)
    }
  }, [])
}
