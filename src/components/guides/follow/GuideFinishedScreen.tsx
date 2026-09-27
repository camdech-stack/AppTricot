import { PartyPopper } from 'lucide-react'
import styles from './FinishedScreens.module.css'
import { Button } from '../../ui'

interface GuideFinishedScreenProps {
  projectStatus: string
  onMarkProjectDone: () => void
  onRestart: () => void
}

// Every piece is done — a sober congratulations screen (see CLAUDE.md
// "Fin du guide"). Marking the project done goes through the same
// existing status/date rules as changing it by hand; it's never automatic.
export function GuideFinishedScreen({ projectStatus, onMarkProjectDone, onRestart }: GuideFinishedScreenProps) {
  return (
    <div className={styles.page}>
      <PartyPopper size={48} strokeWidth={1.75} />
      <p className={styles.title}>Guide terminé !</p>
      <p className={styles.subtitle}>Toutes les pièces sont finies.</p>
      <div className={styles.actions}>
        {projectStatus !== 'done' && (
          <Button size="lg" onClick={onMarkProjectDone}>
            Marquer le projet comme terminé
          </Button>
        )}
        <Button variant="secondary" onClick={onRestart}>
          Recommencer
        </Button>
      </div>
    </div>
  )
}
