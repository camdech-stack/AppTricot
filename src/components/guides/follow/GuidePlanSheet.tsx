import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import styles from './GuidePlanSheet.module.css'
import { ConfirmDialog, Pill, Sheet } from '../../ui'
import {
  createEmptyPieceProgress,
  getNodeStatus,
  isContainerBlock,
  type Block,
  type GuideContent,
  type GuideProgressState,
  type Piece,
  type Section,
} from '../../../data'

interface FlatRow {
  id: string
  number: number | null
  text: string
}

function flattenSectionRows(section: Section): FlatRow[] {
  const rows: FlatRow[] = []
  function walk(blocks: Block[]) {
    for (const block of blocks) {
      if (block.type === 'rows') {
        for (const row of block.rows) rows.push({ id: row.id, number: row.number, text: row.instructions })
      } else if (isContainerBlock(block)) {
        walk(block.blocks)
      }
    }
  }
  walk(section.blocks)
  return rows
}

const STATUS_LABELS: Record<'todo' | 'in_progress' | 'done', string> = { todo: 'À faire', in_progress: 'En cours', done: 'Fait' }
const STATUS_COLORS: Record<'todo' | 'in_progress' | 'done', 'gold' | 'primary' | 'sage'> = { todo: 'gold', in_progress: 'primary', done: 'sage' }

interface GuidePlanSheetProps {
  open: boolean
  onClose: () => void
  content: GuideContent
  progress: GuideProgressState
  onGoTo: (pieceId: string, targetNodeId: string) => void
  onRestartPiece: (pieceId: string) => void
  onRestartGuide: () => void
}

// "Plan du guide" (see CLAUDE.md) — a row is only reachable ("Aller ici")
// from the active piece or an already-done one; a future piece's rows stay
// disabled with an explanatory note.
export function GuidePlanSheet({ open, onClose, content, progress, onGoTo, onRestartPiece, onRestartGuide }: GuidePlanSheetProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [restartGuideConfirm, setRestartGuideConfirm] = useState(false)
  const [restartPieceConfirm, setRestartPieceConfirm] = useState<string | null>(null)
  const [goToConfirm, setGoToConfirm] = useState<{ pieceId: string; rowId: string; label: string } | null>(null)

  function toggleSection(id: string) {
    setExpandedSections((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Plan du guide">
        {content.pieces.map((piece: Piece, index) => {
          const pieceProgress = progress.pieces[piece.id] ?? createEmptyPieceProgress()
          const status = getNodeStatus(piece, pieceProgress, piece.id)
          const reachable = piece.id === progress.activePieceId || pieceProgress.status === 'done'
          const previousPiece = content.pieces[index - 1]

          return (
            <div key={piece.id} className={styles.pieceBlock}>
              <div className={styles.pieceHeader}>
                <span className={styles.pieceName}>{piece.name || 'Pièce'}</span>
                <Pill color={STATUS_COLORS[status.status]}>
                  {STATUS_LABELS[status.status]} · {status.percent} %
                </Pill>
              </div>
              {!reachable && (
                <p className={styles.lockedNote}>Termine d’abord {previousPiece?.name || 'la pièce précédente'}.</p>
              )}
              {reachable && (
                <button type="button" className={styles.restartPieceButton} onClick={() => setRestartPieceConfirm(piece.id)}>
                  Recommencer cette pièce
                </button>
              )}

              {piece.sections.map((section: Section) => {
                const sectionStatus = getNodeStatus(piece, pieceProgress, section.id)
                const isExpanded = expandedSections.has(section.id)
                const rows = flattenSectionRows(section)
                return (
                  <div key={section.id} className={styles.sectionBlock}>
                    <button type="button" className={styles.sectionHeader} onClick={() => toggleSection(section.id)}>
                      {isExpanded ? <ChevronDown size={16} strokeWidth={1.75} /> : <ChevronRight size={16} strokeWidth={1.75} />}
                      <span className={styles.sectionName}>{section.name || 'Section'}</span>
                      <Pill color={STATUS_COLORS[sectionStatus.status]}>{sectionStatus.percent} %</Pill>
                    </button>
                    {isExpanded && (
                      <div className={styles.rowList}>
                        {rows.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            disabled={!reachable}
                            className={reachable ? styles.rowItem : `${styles.rowItem} ${styles.rowItemLocked}`}
                            onClick={() =>
                              setGoToConfirm({ pieceId: piece.id, rowId: row.id, label: row.number != null ? `Rang ${row.number}` : 'Ce rang' })
                            }
                          >
                            <span className={styles.rowNumber}>{row.number ?? '—'}</span>
                            <span className={styles.rowText}>{row.text || '—'}</span>
                          </button>
                        ))}
                        {rows.length === 0 && <p className={styles.rowText}>Aucun rang.</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        <button type="button" className={styles.restartGuideButton} onClick={() => setRestartGuideConfirm(true)}>
          Recommencer le guide
        </button>
      </Sheet>

      <ConfirmDialog
        open={goToConfirm !== null}
        title="Aller ici"
        message={`Aller à "${goToConfirm?.label ?? ''}" ? Cette action change ta position actuelle dans cette pièce.`}
        confirmLabel="Aller ici"
        onConfirm={() => {
          if (goToConfirm) onGoTo(goToConfirm.pieceId, goToConfirm.rowId)
          setGoToConfirm(null)
          onClose()
        }}
        onCancel={() => setGoToConfirm(null)}
      />

      <ConfirmDialog
        open={restartPieceConfirm !== null}
        title="Recommencer cette pièce"
        message="La progression de cette pièce (et des pièces suivantes déjà avancées) sera effacée. Le temps passé et les compteurs ne sont pas remis à zéro."
        confirmLabel="Recommencer"
        danger
        onConfirm={() => {
          if (restartPieceConfirm) onRestartPiece(restartPieceConfirm)
          setRestartPieceConfirm(null)
          onClose()
        }}
        onCancel={() => setRestartPieceConfirm(null)}
      />

      <ConfirmDialog
        open={restartGuideConfirm}
        title="Recommencer le guide"
        message="Toute la progression sera effacée. Le temps passé et les compteurs ne sont pas remis à zéro."
        confirmLabel="Recommencer"
        danger
        onConfirm={() => {
          onRestartGuide()
          setRestartGuideConfirm(false)
          onClose()
        }}
        onCancel={() => setRestartGuideConfirm(false)}
      />
    </>
  )
}
