import styles from './CheckpointScreen.module.css'
import type { CursorDescription } from '../../../data'

interface CheckpointScreenProps {
  description: CursorDescription | null
  onReached: () => void
  onNotReached: () => void
  onFinishNow: () => void
}

// "Longueur atteinte ?" / "Nombre de mailles atteint ?" — the dedicated
// screen for a measure/stitch_count block's checkpoint (see CLAUDE.md
// "Point de contrôle").
export function CheckpointScreen({ description, onReached, onNotReached, onFinishNow }: CheckpointScreenProps) {
  return (
    <div className={styles.page}>
      <p className={styles.question}>{description?.blockLabel ?? 'Objectif atteint ?'}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.yesButton} onClick={onReached}>
          Oui, continuer
        </button>
        <button type="button" className={styles.notYetButton} onClick={onNotReached}>
          Pas encore, refaire un passage
        </button>
        <button type="button" className={styles.finishNowButton} onClick={onFinishNow}>
          Terminer ce bloc maintenant
        </button>
      </div>
    </div>
  )
}
