import { useEffect, useState } from 'react'
import { ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react'
import styles from './RowsScreen.module.css'
import { FullScreenPanel } from './FullScreenPanel'
import { Pill } from '../../ui'
import { SortableList, DragHandle } from './SortableList'
import type { Row, RowSide } from '../../../data'

export interface RowPatch {
  number: number | null
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
}

// Full-screen "Rangs" screen (retour utilisateur) replacing the old
// per-row popup: every row of a rows block is inline-editable on one
// screen, with direct duplicate/delete icons — no "⋯" menu for rows.
export function RowsScreen({ open, onClose, rows, showSide, onReorder, onChangeRow, onDuplicateRow, onDeleteRow, onAddRow, onPasteRows }: RowsScreenProps) {
  return (
    <FullScreenPanel open={open} onClose={onClose} title="Rangs">
      <div className={styles.list}>
        <SortableList
          items={rows}
          onReorder={onReorder}
          renderItem={(row) => (
            <RowCard
              row={row}
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
  showSide: boolean
  onChange: (patch: RowPatch) => void
  onDuplicate: () => void
  onDelete: () => void
}

function RowCard({ row, showSide, onChange, onDuplicate, onDelete }: RowCardProps) {
  const [number, setNumber] = useState(row.number != null ? String(row.number) : '')
  const [instructions, setInstructions] = useState(row.instructions)
  const [stitchesAfter, setStitchesAfter] = useState(row.stitchesAfter != null ? String(row.stitchesAfter) : '')

  useEffect(() => {
    setNumber(row.number != null ? String(row.number) : '')
    setInstructions(row.instructions)
    setStitchesAfter(row.stitchesAfter != null ? String(row.stitchesAfter) : '')
  }, [row.id, row.number, row.instructions, row.stitchesAfter])

  function commit(overrides: Partial<RowPatch> = {}) {
    onChange({
      number: number.trim() === '' ? null : Number.parseInt(number, 10),
      side: showSide ? row.side : null,
      instructions,
      stitchesAfter: stitchesAfter.trim() === '' ? null : Number.parseInt(stitchesAfter, 10),
      ...overrides,
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <DragHandle />
        <input
          className={styles.numberInput}
          inputMode="numeric"
          aria-label="Numéro du rang"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          onBlur={() => commit()}
        />
        {showSide && (
          <div className={styles.sideToggle}>
            <button
              type="button"
              className={row.side === 'rs' ? styles.sideOptionActive : styles.sideOption}
              onClick={() => commit({ side: row.side === 'rs' ? null : 'rs' })}
            >
              <Pill color="primary" className={styles.sidePill}>
                END
              </Pill>
            </button>
            <button
              type="button"
              className={row.side === 'ws' ? styles.sideOptionActive : styles.sideOption}
              onClick={() => commit({ side: row.side === 'ws' ? null : 'ws' })}
            >
              <Pill color="blue" className={styles.sidePill}>
                ENV
              </Pill>
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
        className={styles.textarea}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        onBlur={() => commit()}
        rows={2}
        placeholder="*2 m end, 2 m env* rép."
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
