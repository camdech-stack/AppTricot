import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, PartyPopper } from 'lucide-react'
import styles from './GuidePreviewScreen.module.css'
import { CheckpointScreen } from './CheckpointScreen'
import { GuideProgressHeader } from './GuideProgressHeader'
import { StepCards } from './StepCards'
import { StepOverviewCard } from './StepOverviewCard'
import { Button, IconButton, Pill } from '../../ui'
import { PdfViewerCore } from '../../patterns/PdfViewerCore'
import {
  advance,
  back as backCursor,
  computeStepsDone,
  describeCursor,
  getContainerStepOverview,
  getInitialCursor,
  getPieceProgress,
  type AdvanceOptions,
  type Cursor,
  type GuideContent,
  type Piece,
} from '../../../data'

interface GuidePreviewScreenProps {
  guideName: string
  content: GuideContent
  // Omitted when the guide has no linked pattern.
  linkedPattern?: { id: string; name: string } | null
  onBack: () => void
}

// Read-only, project-free way to browse a guide exactly as it will look
// while following it — no session, no chrono, no linked counter, nothing
// written to guideProgress. Free navigation between every piece (a preview
// has no "verrouillée" pieces, since nothing is actually being tracked).
// See CLAUDE.md "Aperçu du guide".
export function GuidePreviewScreen({ guideName, content, linkedPattern, onBack }: GuidePreviewScreenProps) {
  const firstPieceWithSteps = content.pieces.find((piece) => getInitialCursor(piece) !== null) ?? content.pieces[0]
  const [pieceId, setPieceId] = useState<string | null>(firstPieceWithSteps?.id ?? null)
  const [cursor, setCursor] = useState<Cursor | null>(firstPieceWithSteps ? getInitialCursor(firstPieceWithSteps) : null)
  const [history, setHistory] = useState<Cursor[]>([])
  const [guideFinished, setGuideFinished] = useState(false)
  const [patternOpen, setPatternOpen] = useState(false)

  const piece = content.pieces.find((candidate) => candidate.id === pieceId) ?? null

  function selectPiece(next: Piece) {
    setPieceId(next.id)
    setCursor(getInitialCursor(next))
    setHistory([])
    setGuideFinished(false)
  }

  useEffect(() => {
    // The guide changed underneath the preview (e.g. edited in another tab) —
    // land back on the current piece's first step rather than risk pointing
    // at a node that no longer exists.
    if (piece && cursor && describeCursor(content, cursor) === null) {
      setCursor(getInitialCursor(piece))
      setHistory([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  function applyResult(result: Cursor | 'finished') {
    if (result === 'finished') {
      const index = content.pieces.findIndex((candidate) => candidate.id === pieceId)
      const nextPiece = content.pieces[index + 1]
      if (nextPiece) selectPiece(nextPiece)
      else setGuideFinished(true)
      return
    }
    if (cursor) setHistory((current) => [...current, cursor])
    setCursor(result)
  }

  function goForward(options?: AdvanceOptions) {
    if (!piece || !cursor) return
    applyResult(advance(piece, cursor, options ?? {}))
  }

  function goBack() {
    if (!piece) return
    const result = backCursor(piece, cursor, history)
    if (history.length > 0) setHistory((current) => current.slice(0, -1))
    setCursor(result)
  }

  function restart() {
    if (firstPieceWithSteps) selectPiece(firstPieceWithSteps)
  }

  const header = (
    <div className={styles.header}>
      <IconButton icon={<ArrowLeft strokeWidth={1.75} />} label="Retour" onClick={onBack} />
      <span className={styles.headerTitle}>{guideName}</span>
    </div>
  )

  const pieceSelector = content.pieces.length > 1 && (
    <div className={styles.pieceSelector}>
      {content.pieces.map((candidate) => (
        <button key={candidate.id} type="button" aria-pressed={candidate.id === pieceId} onClick={() => selectPiece(candidate)}>
          {candidate.name || 'Pièce'}
        </button>
      ))}
    </div>
  )

  if (content.pieces.length === 0) {
    return (
      <div className={styles.page}>
        {header}
        <p className={styles.emptyText}>Ce guide n’a pas encore de pièce à prévisualiser.</p>
      </div>
    )
  }

  if (patternOpen && linkedPattern) {
    return (
      <div className={styles.pdfOverlay}>
        <PdfViewerCore patternId={linkedPattern.id} projectId={null} patternName={linkedPattern.name} onBack={() => setPatternOpen(false)} />
      </div>
    )
  }

  if (guideFinished) {
    return (
      <div className={styles.page}>
        {header}
        {pieceSelector}
        <div className={styles.finishedNote}>
          <PartyPopper size={40} strokeWidth={1.75} />
          <p>Fin de l’aperçu : toutes les pièces ont été parcourues.</p>
          <Button onClick={restart}>Recommencer l’aperçu</Button>
        </div>
      </div>
    )
  }

  if (!piece || !cursor) {
    return (
      <div className={styles.page}>
        {header}
        {pieceSelector}
        <p className={styles.emptyText}>Cette pièce n’a pas encore de pas à prévisualiser.</p>
      </div>
    )
  }

  const description = describeCursor(content, cursor)
  const piecePercent = getPieceProgress(piece, { status: 'in_progress', cursor, history: [], stepsDone: computeStepsDone(piece, cursor) }).percent

  if (cursor.step === 'checkpoint') {
    return (
      <div className={styles.page}>
        {header}
        {pieceSelector}
        <div className={styles.body}>
          <Pill color="blue" className={styles.previewPill}>
            Aperçu — lecture seule
          </Pill>
          <GuideProgressHeader pieceName={piece.name} sectionName={description?.sectionName} percent={piecePercent} />
          <CheckpointScreen
            description={description}
            onReached={() => goForward({ reached: true })}
            onNotReached={() => goForward({ reached: false })}
            onFinishNow={() => goForward({ finishBlock: true })}
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
  const overviewEntries = description?.innermostContainer ? getContainerStepOverview(content, description.innermostContainer.nodeId, cursor.nodeId) : null

  return (
    <div className={styles.page}>
      {header}
      {pieceSelector}

      <div className={styles.body}>
        <Pill color="blue" className={styles.previewPill}>
          Aperçu — lecture seule
        </Pill>

        <GuideProgressHeader pieceName={piece.name} sectionName={description?.sectionName} percent={piecePercent} />

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
        <button type="button" className={styles.nextButton} onClick={() => goForward()}>
          {nextButtonLabel}
        </button>
        <button type="button" className={styles.backButton} disabled={history.length === 0} onClick={goBack}>
          Précédent
        </button>
      </div>
    </div>
  )
}
