import { Pause, Play } from 'lucide-react'
import styles from './ChronoButton.module.css'
import { formatClockDuration, formatDuration } from '../../utils/formatDuration'
import type { CounterChrono } from '../../hooks/useCounterChrono'

interface ChronoButtonProps {
  chrono: CounterChrono
}

// The chrono button, shared as-is between the counter screen and the guide
// follow screen (step 5b) — same rules everywhere: manual stop possible,
// restarts only on a tap, never auto-restarts after a manual stop on the
// same target (see CLAUDE.md "Suivi du temps").
export function ChronoButton({ chrono }: ChronoButtonProps) {
  return (
    <button
      type="button"
      className={chrono.running ? styles.chronoButtonRunning : styles.chronoButton}
      onClick={chrono.toggle}
      aria-label={chrono.running ? `En cours : ${formatDuration(chrono.elapsedMs)}, arrêter le chrono` : chrono.label}
    >
      {chrono.running ? (
        <>
          <span className={styles.chronoDot} aria-hidden="true" />
          <span>En cours : {formatClockDuration(chrono.elapsedMs)}</span>
          <Pause size={18} strokeWidth={1.75} />
        </>
      ) : (
        <>
          <Play size={18} strokeWidth={1.75} />
          <span>{chrono.label}</span>
        </>
      )}
    </button>
  )
}
