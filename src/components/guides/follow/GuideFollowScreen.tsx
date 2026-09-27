import { useState } from 'react'
import { ArrowLeft, MoreHorizontal, Pencil } from 'lucide-react'
import styles from './GuideFollowScreen.module.css'
import { CheckpointScreen } from './CheckpointScreen'
import { PieceFinishedScreen } from './PieceFinishedScreen'
import { GuideFinishedScreen } from './GuideFinishedScreen'
import { GuideFollowMenuSheet } from './GuideFollowMenuSheet'
import { GuidePlanSheet } from './GuidePlanSheet'
import { LinkedCounterSheet } from './LinkedCounterSheet'
import { CorrectStepSheet } from './CorrectStepSheet'
import { IconButton, Pill } from '../../ui'
import { ChronoButton } from '../../counters/ChronoButton'
import { useCounterChrono } from '../../../hooks/useCounterChrono'
import { useSettings } from '../../../hooks/useSettings'
import { useCounters } from '../../../hooks/useCounters'
import {
  advance,
  advanceGuide,
  createEmptyPieceProgress,
  describeCursor,
  findNode,
  getNextAvailablePieceId,
  repairActiveCursor,
  resetProgress,
  saveGuideContent,
  setLinkedCounter,
  startGuide,
  updateProject,
  type Block,
  type GuideContent,
  type GuideProgressRecord,
  type GuideRowTextSize,
  type ProjectRecord,
} from '../../../data'

const TEXT_SIZE_CLASS: Record<GuideRowTextSize, string | undefined> = {
  small: styles.textSizeSmall,
  medium: styles.textSizeMedium,
  large: styles.textSizeLarge,
  xlarge: styles.textSizeXlarge,
}

// True while the cursor sits anywhere inside a measure/stitch_count block
// (not just at its checkpoint) — "Terminer ce bloc maintenant" only makes
// sense to offer then (see CLAUDE.md "Point de contrôle").
function isInsideVariableLengthBlock(content: GuideContent, ancestorIds: string[]): boolean {
  return ancestorIds.some((id) => {
    const found = findNode(content, id)
    const block = found?.kind === 'block' ? (found.node as Block) : undefined
    return block?.type === 'measure' || block?.type === 'stitch_count'
  })
}

interface GuideFollowScreenProps {
  projectId: string
  guideId: string
  project: ProjectRecord
  content: GuideContent
  progress: GuideProgressRecord
  onBack: () => void
}

export function GuideFollowScreen({ projectId, guideId, project, content, progress, onBack }: GuideFollowScreenProps) {
  const settings = useSettings()
  const chrono = useCounterChrono({ projectId }, 'guide')
  const counters = useCounters(projectId) ?? []

  const [menuOpen, setMenuOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [counterSheetOpen, setCounterSheetOpen] = useState(false)
  const [correctOpen, setCorrectOpen] = useState(false)
  const [adjustedMessage, setAdjustedMessage] = useState<string | null>(null)

  const nextPieceId = getNextAvailablePieceId(content, progress)

  function handleGoTo(pieceId: string, targetNodeId: string) {
    void advanceGuide(projectId, guideId, { type: 'goTo', pieceId, targetNodeId })
  }

  function handleRestartPiece(pieceId: string) {
    void resetProgress(projectId, guideId, { type: 'piece', pieceId }).then(() => startGuide(projectId, guideId))
  }

  function handleRestartGuide() {
    void resetProgress(projectId, guideId, { type: 'guide' }).then(() => startGuide(projectId, guideId))
  }

  async function handleContentChanged(next: GuideContent) {
    await saveGuideContent(guideId, next)
    const result = await repairActiveCursor(projectId, guideId)
    if (result.adjusted) {
      setAdjustedMessage('Le guide a changé, ta position a été ajustée.')
      window.setTimeout(() => setAdjustedMessage(null), 4000)
    }
  }

  const header = (
    <div className={styles.header}>
      <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} />
      <span className={styles.breadcrumb}>{breadcrumbFor(content, progress)}</span>
      {settings?.trackingEnabled !== false && <ChronoButton chrono={chrono} />}
      <IconButton icon={<MoreHorizontal strokeWidth={1.75} />} label="Menu du guide" onClick={() => setMenuOpen(true)} />
    </div>
  )

  if (nextPieceId === null) {
    return (
      <div className={styles.page}>
        {header}
        <GuideFinishedScreen
          projectStatus={project.status}
          onMarkProjectDone={() => void updateProject(projectId, { status: 'done' })}
          onRestart={handleRestartGuide}
        />
      </div>
    )
  }

  if (progress.activePieceId === null) {
    const nextIndex = content.pieces.findIndex((piece) => piece.id === nextPieceId)
    const finishedPiece = content.pieces[nextIndex - 1]
    const nextPiece = content.pieces[nextIndex]
    return (
      <div className={styles.page}>
        {header}
        <PieceFinishedScreen
          finishedPieceName={finishedPiece?.name ?? ''}
          nextPieceName={nextPiece?.name ?? ''}
          onContinue={() => void startGuide(projectId, guideId)}
          onBack={onBack}
        />
      </div>
    )
  }

  const piece = content.pieces.find((candidate) => candidate.id === progress.activePieceId)
  const pieceProgress = progress.pieces[progress.activePieceId] ?? createEmptyPieceProgress()

  if (!piece || !pieceProgress.cursor) {
    return <div className={styles.page}>{header}</div>
  }

  const cursor = pieceProgress.cursor
  const description = describeCursor(content, cursor)

  if (cursor.step === 'checkpoint') {
    return (
      <div className={styles.page}>
        {header}
        <CheckpointScreen
          description={description}
          onReached={() => void advanceGuide(projectId, guideId, { type: 'reached' })}
          onNotReached={() => void advanceGuide(projectId, guideId, { type: 'notReached' })}
          onFinishNow={() => void advanceGuide(projectId, guideId, { type: 'finishBlock' })}
        />
      </div>
    )
  }

  const nextResult = advance(piece, cursor, {})
  const nextDescription = nextResult === 'finished' ? null : describeCursor(content, nextResult)
  const nextPreviewLabel =
    nextResult === 'finished' ? 'Fin de la pièce' : (nextDescription?.rowLabel ?? nextDescription?.blockLabel ?? nextDescription?.text ?? '')

  const nextButtonLabel = cursor.step === 'row' ? 'Rang suivant' : cursor.step === 'text' ? "J'ai fini" : 'Continuer'
  const canFinishBlockNow = isInsideVariableLengthBlock(content, Object.keys(cursor.passages))
  const textSizeClass = TEXT_SIZE_CLASS[settings?.guideRowTextSize ?? 'medium']

  return (
    <div className={styles.page}>
      {header}

      <div className={`${styles.body} ${textSizeClass}`}>
        {description?.repeatLabel && (
          <div className={styles.repeatPill}>
            <Pill color="gold">{description.repeatLabel}</Pill>
          </div>
        )}

        {adjustedMessage && <Pill color="terracotta">{adjustedMessage}</Pill>}

        <div className={styles.card}>
          {cursor.step === 'row' && (
            <>
              <div className={styles.rowNumber}>
                {description?.rowLabel ?? 'Rang'}
                {description?.side && <Pill color={description.side === 'rs' ? 'primary' : 'blue'}> {description.side === 'rs' ? 'END' : 'ENV'}</Pill>}
              </div>
              <p className={styles.rowText}>{description?.text || '—'}</p>
              {description?.stitchesAfter != null && <p className={styles.stitchesAfter}>Mailles après : {description.stitchesAfter}</p>}
            </>
          )}
          {cursor.step === 'text' && <p className={styles.rowText}>{description?.text || '—'}</p>}
          {cursor.step === 'operation' && (
            <>
              <div className={styles.blockLabel}>{description?.blockLabel}</div>
              {description?.stitchesAfter != null && <p className={styles.stitchesAfter}>{description.stitchesAfter} mailles</p>}
              {description?.text && <p className={styles.rowText}>{description.text}</p>}
            </>
          )}
          {cursor.step === 'single' && <p className={styles.rowText}>{description?.blockLabel}</p>}

          <button type="button" className={styles.correctButton} onClick={() => setCorrectOpen(true)}>
            <Pencil size={14} strokeWidth={1.75} />
            Corriger
          </button>
          {canFinishBlockNow && (
            <button
              type="button"
              className={styles.correctButton}
              onClick={() => void advanceGuide(projectId, guideId, { type: 'finishBlock' })}
            >
              Terminer ce bloc maintenant
            </button>
          )}
        </div>

        {nextPreviewLabel && <p className={styles.nextPreview}>Ensuite : {nextPreviewLabel}</p>}
      </div>

      <div className={styles.buttonZone}>
        <button type="button" className={styles.nextButton} onClick={() => void advanceGuide(projectId, guideId, { type: 'next' })}>
          {nextButtonLabel}
        </button>
        <button type="button" className={styles.backButton} onClick={() => void advanceGuide(projectId, guideId, { type: 'back' })}>
          Précédent
        </button>
      </div>

      <GuideFollowMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenLinkedCounter={() => setCounterSheetOpen(true)}
        onOpenPlan={() => setPlanOpen(true)}
        onCorrect={() => setCorrectOpen(true)}
        canCorrect
      />

      {planOpen && (
        <GuidePlanSheet
          open
          onClose={() => setPlanOpen(false)}
          content={content}
          progress={progress}
          onGoTo={handleGoTo}
          onRestartPiece={handleRestartPiece}
          onRestartGuide={handleRestartGuide}
        />
      )}

      <LinkedCounterSheet
        open={counterSheetOpen}
        onClose={() => setCounterSheetOpen(false)}
        counters={counters}
        linkedCounterId={progress.linkedCounterId}
        onSelect={(counterId) => void setLinkedCounter(projectId, guideId, counterId)}
      />

      {correctOpen && (
        <CorrectStepSheet
          open
          onClose={() => setCorrectOpen(false)}
          content={content}
          cursor={cursor}
          onContentChanged={(next) => void handleContentChanged(next)}
        />
      )}
    </div>
  )
}

function breadcrumbFor(content: GuideContent, progress: GuideProgressRecord): string {
  const piece = content.pieces.find((candidate) => candidate.id === progress.activePieceId)
  if (!piece) return ''
  const pieceProgress = progress.pieces[piece.id]
  const cursor = pieceProgress?.cursor
  const description = cursor ? describeCursor(content, cursor) : null
  return [piece.name, description?.sectionName].filter(Boolean).join(' > ')
}
