import { useLiveQuery } from 'dexie-react-hooks'
import {
  getLiveSessionId,
  getOpenSession,
  getSessionDuration,
  isManuallyStoppedFor,
  startSession,
  stopSession,
  type SessionOrigin,
  type SessionTarget,
} from '../data'
import { useNow } from './useNow'

const REFRESH_INTERVAL_MS = 10_000

export interface CounterChrono {
  running: boolean
  label: string
  elapsedMs: number
  toggle: () => void
}

// Backs the chrono button on the counter screen (CLAUDE.md, "Interface" >
// "Bouton de chrono"): reads the single app-wide open session and reflects
// whether it belongs to *this* target, refreshed every 10s while running.
export function useCounterChrono(target: SessionTarget, origin: SessionOrigin): CounterChrono {
  const openSession = useLiveQuery(() => getOpenSession(), [])
  const running = Boolean(openSession && openSession.projectId === target.projectId)
  const now = useNow(REFRESH_INTERVAL_MS)

  const elapsedMs = running && openSession ? getSessionDuration(openSession, now, getLiveSessionId()) : 0

  function toggle() {
    if (running) {
      void stopSession('user_stop')
    } else {
      void startSession(target, origin)
    }
  }

  const label = running ? '' : isManuallyStoppedFor(target) ? 'Reprendre le chrono' : 'Démarrer le chrono'

  return { running, label, elapsedMs, toggle }
}
