import { useEffect, useState } from 'react'
import { ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react'
import formStyles from './FormSheet.module.css'
import styles from './RowsScreen.module.css'
import { FullScreenPanel, type LinkedPatternRef } from './FullScreenPanel'
import { SortableList, DragHandle } from './SortableList'
import type { Row, RowSide } from '../../../data'

export interface RowPatch {
  side: RowSide | null
  instructions: string
  stitchesAfter: number | null
}

interface RowsScreenProps {
  open: boolean
  onClose: () => void
  rows: Row[]
  // Only meaningful in a 'flat' section — a 'round' section never shows a
  // side per row (see GuideRow.side).
  showSide: boolean
  onReorder: (rowId: string, targetIndex: number) => void
  onChangeRow: (rowId: string, patch: RowPatch) => void
  onDuplicateRow: (rowId: string) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  onPasteRows: () => void
  linkedPattern?: LinkedPatternRef | null
}

// Full-screen "Rangs" screen (retour utilisateur) replacing the old
// per-row popup: every row of a rows block is inline-editable on one
// screen, with direct duplicate/delete icons — no "⋯" menu for rows.
export function RowsScreen({ open, onClose, rows, showSide, onReorder, onChangeRow, onDuplicateRow, onDeleteRow, onAddRow, onPasteRows, linkedPattern }: RowsScreenProps) {
  return (
    <FullScreenPanel open={open} onClose={onClose} title="Rangs" linkedPattern={linkedPattern}>
      <div className={styles.list}>
        <SortableList
          items={rows}
          onReorder={onReorder}
          renderItem={(row, index) => (
            <RowCard
              row={row}
              // The displayed row number is always the row's position within
              // its block, never a stored/editable value — see CLAUDE.md
              // "Rangs" (étape 5a, part 2) — so it's automatically right
              // after a drag reorder.
              number={index + 1}
              showSide={showSide}
              onChange={(patch) => onChangeRow(row.id, patch)}
              onDuplicate={() => onDuplicateRow(row.id)}
              onDelete={() => onDeleteRow(row.id)}
            />
          )}
        />
        {rows.length === 0 && <p className={styles.empty}>Aucun rang pour l’instant.</p>}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.actionButton} onClick={onAddRow}>
          <Plus size={16} strokeWidth={1.75} />
          Ajouter un rang
        </button>
        <button type="button" className={styles.actionButton} onClick={onPasteRows}>
          <ClipboardPaste size={16} strokeWidth={1.75} />
          Coller plusieurs rangs
        </button>
      </div>
    </FullScreenPanel>
  )
}

interface RowCardProps {
  row: Row
  number: number
  showSide: boolean
  onChange: (patch: RowPatch) => void
  onDuplicate: () => void
  onDelete: () => void
}

// A round section is always worked from the right side by convention, so
// its rows keep the "endroit" (rose) accent regardless of `row.side` (which
// is always null there — see Row.side in guideModel.ts).
function sideAccentClass(row: Row, showSide: boolean): string | undefined {
  if (!showSide || row.side === 'rs') return styles.cardRs
  if (row.side === 'ws') return styles.cardWs
  return styles.cardNeutral
}

function RowCard({ row, number, showSide, onChange, onDuplicate, onDelete }: RowCardProps) {
  const [instructions, setInstructions] = useState(row.instructions)
  const [stitchesAfter, setStitchesAfter] = useState(row.stitchesAfter != null ? String(row.stitchesAfter) : '')

  useEffect(() => {
    setInstructions(row.instructions)
    setStitchesAfter(row.stitchesAfter != null ? String(row.stitchesAfter) : '')
  }, [row.id, row.instructions, row.stitchesAfter])

  function commit(overrides: Partial<RowPatch> = {}) {
    onChange({
      side: showSide ? row.side : null,
      instructions,
      stitchesAfter: stitchesAfter.trim() === '' ? null : Number.parseInt(stitchesAfter, 10),
      ...overrides,
    })
  }

  return (
    <div className={[styles.card, sideAccentClass(row, showSide)].filter(Boolean).join(' ')}>
      <div className={styles.cardHeader}>
        <DragHandle />
        <span className={styles.numberBadge}>{number}</span>
        {showSide && (
          <div className={styles.sideToggle}>
            <button
              type="button"
              className={row.side === 'rs' ? styles.sideOptionActive : styles.sideOption}
              onClick={() => commit({ side: row.side === 'rs' ? null : 'rs' })}
            >
              END
            </button>
            <button
              type="button"
              className={row.side === 'ws' ? styles.sideOptionActiveWs : styles.sideOption}
              onClick={() => commit({ side: row.side === 'ws' ? null : 'ws' })}
            >
              ENV
            </button>
          </div>
        )}
        <span className={styles.cardHeaderSpacer} />
        <button type="button" className={styles.iconButton} aria-label="Dupliquer ce rang" onClick={onDuplicate}>
          <Copy size={18} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.iconButtonDanger} aria-label="Supprimer ce rang" onClick={onDelete}>
          <Trash2 size={18} strokeWidth={1.75} />
        </button>
      </div>
      <textarea
        className={formStyles.textareaPlain}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        onBlur={() => commit()}
        rows={2}
        placeholder="Instructions…"
      />
      <label className={styles.stitchesField}>
        <span>Mailles après ce rang</span>
        <input
          className={styles.stitchesInput}
          inputMode="numeric"
          value={stitchesAfter}
          onChange={(event) => setStitchesAfter(event.target.value)}
          onBlur={() => commit()}
          placeholder="—"
        />
      </label>
    </div>
  )
}
