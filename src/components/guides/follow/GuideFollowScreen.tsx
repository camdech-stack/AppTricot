import { useState } from 'react'
import { ArrowLeft, BookOpen, MoreHorizontal } from 'lucide-react'
import styles from './GuideFollowScreen.module.css'
import { CheckpointScreen } from './CheckpointScreen'
import { PieceFinishedScreen } from './PieceFinishedScreen'
import { GuideFinishedScreen } from './GuideFinishedScreen'
import { GuideFollowMenuSheet } from './GuideFollowMenuSheet'
import { GuidePlanSheet } from './GuidePlanSheet'
import { LinkedCounterSheet } from './LinkedCounterSheet'
import { CorrectStepSheet } from './CorrectStepSheet'
import { GuideProgressHeader } from './GuideProgressHeader'
import { StepCards } from './StepCards'
import { StepOverviewCard } from './StepOverviewCard'
import { IconButton, Pill } from '../../ui'
import { ChronoButton } from '../../counters/ChronoButton'
import { PdfViewerCore } from '../../patterns/PdfViewerCore'
import { useCounterChrono } from '../../../hooks/useCounterChrono'
import { useSettings } from '../../../hooks/useSettings'
import { useCounters } from '../../../hooks/useCounters'
import {
  advance,
  advanceGuide,
  createEmptyPieceProgress,
  describeCursor,
  findNode,
  getContainerStepOverview,
  getNextAvailablePieceId,
  getPieceProgress,
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
  guideName: string
  project: ProjectRecord
  content: GuideContent
  progress: GuideProgressRecord
  // Omitted when the guide has no linked pattern — see CLAUDE.md "Voir le
  // patron depuis le suivi".
  linkedPattern?: { id: string; name: string } | null
  // Omitted when embedded in a page that already has its own back button
  // (the project work view's "Guide" tab) — see CLAUDE.md "Vue de travail".
  onBack?: () => void
}

export function GuideFollowScreen({ projectId, guideId, guideName, project, content, progress, linkedPattern, onBack }: GuideFollowScreenProps) {
  const settings = useSettings()
  const chrono = useCounterChrono({ projectId }, 'guide')
  const counters = useCounters(projectId) ?? []

  const [menuOpen, setMenuOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [counterSheetOpen, setCounterSheetOpen] = useState(false)
  const [correctOpen, setCorrectOpen] = useState(false)
  const [patternOpen, setPatternOpen] = useState(false)
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
      {onBack && <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} />}
      <span className={styles.headerTitle}>{guideName}</span>
      <IconButton icon={<MoreHorizontal strokeWidth={1.75} />} label="Menu du guide" onClick={() => setMenuOpen(true)} />
    </div>
  )

  if (patternOpen && linkedPattern) {
    return (
      <div className={styles.pdfOverlay}>
        <PdfViewerCore patternId={linkedPattern.id} projectId={projectId} patternName={linkedPattern.name} onBack={() => setPatternOpen(false)} />
      </div>
    )
  }

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
  const piecePercent = getPieceProgress(piece, pieceProgress).percent

  if (cursor.step === 'checkpoint') {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.body}>
          <GuideProgressHeader
            pieceName={piece.name}
            sectionName={description?.sectionName}
            percent={piecePercent}
            chronoSlot={settings?.trackingEnabled !== false ? <ChronoButton chrono={chrono} /> : undefined}
          />
          <CheckpointScreen
            description={description}
            onReached={() => void advanceGuide(projectId, guideId, { type: 'reached' })}
            onNotReached={() => void advanceGuide(projectId, guideId, { type: 'notReached' })}
            onFinishNow={() => void advanceGuide(projectId, guideId, { type: 'finishBlock' })}
          />
        </div>
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
  // A nested repeat's own chain ("Répétition 2 / 3 · Répétition 1 / 2") is
  // only shown as extra context when there's more than one level — the
  // innermost one already has its own card just below.
  const nestedContext = description?.repeatLabel && description.repeatLabel.includes(' · ') ? description.repeatLabel : null
  const overviewEntries = description?.innermostContainer ? getContainerStepOverview(content, description.innermostContainer.nodeId, cursor.nodeId) : null

  return (
    <div className={styles.page}>
      {header}

      <div className={`${styles.body} ${textSizeClass}`}>
        <GuideProgressHeader
          pieceName={piece.name}
          sectionName={description?.sectionName}
          percent={piecePercent}
          chronoSlot={settings?.trackingEnabled !== false ? <ChronoButton chrono={chrono} /> : undefined}
        />

        {nestedContext && <p className={styles.nestedContext}>{nestedContext}</p>}

        {adjustedMessage && <Pill color="terracotta">{adjustedMessage}</Pill>}

        <StepCards
          cursorStep={cursor.step}
          rowLabel={description?.rowLabel ?? null}
          rowIndexInBlock={description?.rowIndexInBlock ?? null}
          rowCountInBlock={description?.rowCountInBlock ?? null}
          side={description?.side ?? null}
          innermostContainer={description?.innermostContainer ?? null}
        />

        <div className={styles.card}>
          {cursor.step === 'row' && (
            <>
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
        </div>

        {nextPreviewLabel && <p className={styles.nextPreview}>Ensuite : {nextPreviewLabel}</p>}

        {overviewEntries && <StepOverviewCard entries={overviewEntries} />}

        {linkedPattern && (
          <button type="button" className={styles.patternButton} onClick={() => setPatternOpen(true)}>
            <BookOpen size={18} strokeWidth={1.75} />
            Voir le patron
          </button>
        )}
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
        onFinishBlock={() => void advanceGuide(projectId, guideId, { type: 'finishBlock' })}
        canFinishBlock={canFinishBlockNow}
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
