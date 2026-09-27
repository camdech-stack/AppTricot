import { ArrowLeft } from 'lucide-react'
import styles from './GuideStartScreen.module.css'
import { IconButton, Button, Pill } from '../../ui'
import {
  countSteps,
  createEmptyPieceProgress,
  getNextAvailablePieceId,
  getResumeSummary,
  type GuideContent,
  type GuideProgressRecord,
  type GuideProgressState,
  type Piece,
} from '../../../data'

interface GuideStartScreenProps {
  guideName: string
  content: GuideContent
  progress: GuideProgressRecord | undefined
  onBack: () => void
  onStart: () => void
}

// Landing screen every time /suivre is opened, whether fresh or mid-guide
// (see CLAUDE.md "Écran de départ") — starting/resuming the chrono only
// happens on "Commencer"/"Reprendre", never just by opening this screen.
export function GuideStartScreen({ guideName, content, progress, onBack, onStart }: GuideStartScreenProps) {
  const state: GuideProgressState = progress ?? { activePieceId: null, pieces: {} }
  const nextPieceId = getNextAvailablePieceId(content, state)
  const hasAnyProgress = Boolean(progress) && Object.keys(state.pieces).length > 0
  const resumeSummary = hasAnyProgress ? getResumeSummary(content, state) : null

  if (content.pieces.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} />
          <span className={styles.title}>{guideName}</span>
        </div>
        <p className={styles.emptyText}>Ce guide n’a pas encore de pièce à suivre. Ajoute-en une depuis l’éditeur.</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} />
        <span className={styles.title}>{guideName}</span>
      </div>

      <div className={styles.pieceList}>
        {content.pieces.map((piece: Piece) => {
          const pieceProgress = state.pieces[piece.id] ?? createEmptyPieceProgress()
          const { known, hasVariableLength } = countSteps(piece)
          const isActivable = piece.id === nextPieceId
          const isLocked = !isActivable && pieceProgress.status !== 'done'
          const previousPiece = content.pieces[content.pieces.indexOf(piece) - 1]

          return (
            <div key={piece.id} className={isLocked ? `${styles.pieceCard} ${styles.pieceCardLocked}` : styles.pieceCard}>
              <div className={styles.pieceInfo}>
                <div className={styles.pieceName}>{piece.name || 'Pièce'}</div>
                <div className={styles.pieceMeta}>
                  {known === 0 ? 'Aucun pas' : `${known}${hasVariableLength ? '+' : ''} pas`}
                  {isLocked && previousPiece && ` · Après "${previousPiece.name || 'la pièce précédente'}"`}
                </div>
              </div>
              <Pill color={pieceProgress.status === 'done' ? 'sage' : isActivable ? 'primary' : 'gold'}>
                {pieceProgress.status === 'done' ? 'Fait' : isActivable ? (pieceProgress.cursor ? 'En cours' : 'À faire') : 'Verrouillée'}
              </Pill>
            </div>
          )
        })}
      </div>

      <div className={styles.actionArea}>
        {resumeSummary?.description && (
          <p className={styles.resumeSummary}>
            {[resumeSummary.description.pieceName, resumeSummary.description.sectionName, resumeSummary.description.rowLabel]
              .filter(Boolean)
              .join(' · ')}
            {resumeSummary.percent != null && ` · ${resumeSummary.percent} %`}
          </p>
        )}
        <Button size="lg" onClick={onStart}>
          {!nextPieceId ? 'Voir le résultat' : hasAnyProgress ? 'Reprendre' : 'Commencer'}
        </Button>
      </div>
    </div>
  )
}
