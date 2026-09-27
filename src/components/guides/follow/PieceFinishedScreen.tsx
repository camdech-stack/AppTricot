import { PartyPopper } from 'lucide-react'
import styles from './FinishedScreens.module.css'
import { Button } from '../../ui'

interface PieceFinishedScreenProps {
  finishedPieceName: string
  nextPieceName: string
  onContinue: () => void
  // Omitted when embedded (the project work view's "Guide" tab) — there's
  // nowhere else to "sortir sans avancer" to (see CLAUDE.md "Vue de travail").
  onBack?: () => void
}

// Shown right after finishing a piece, before the next one has started —
// "Passer à [pièce suivante]" is the only way onward, never a free choice
// (see CLAUDE.md "Principe").
export function PieceFinishedScreen({ finishedPieceName, nextPieceName, onContinue, onBack }: PieceFinishedScreenProps) {
  return (
    <div className={styles.page}>
      <PartyPopper size={40} strokeWidth={1.75} />
      <p className={styles.title}>Pièce terminée</p>
      <p className={styles.subtitle}>{finishedPieceName || 'Cette pièce'} est finie.</p>
      <div className={styles.actions}>
        <Button size="lg" onClick={onContinue}>
          Passer à {nextPieceName || 'la pièce suivante'}
        </Button>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Retour
          </Button>
        )}
      </div>
    </div>
  )
}
