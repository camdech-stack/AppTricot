import { useEffect, useState } from 'react'
import styles from './FormSheet.module.css'
import { Sheet, Button } from '../../ui'
import type { RowSide } from '../../../data'

export interface RowFormInput {
  number: number | null
  side: RowSide | null
  text: string
  stitchesAfter: number | null
}

interface RowSheetProps {
  open: boolean
  onClose: () => void
  // 'create' shows "Enregistrer et ajouter le suivant" and keeps the sheet
  // open with the next number/side prefilled — see CLAUDE.md "Saisie
  // rapide des rangs". 'edit' is a single save.
  mode: 'create' | 'edit'
  // Only meaningful in a 'flat' section (see GuideRow.side).
  showSide: boolean
  initialNumber: number | null
  initialSide: RowSide | null
  initialText?: string
  initialStitchesAfter?: number | null
  onSave: (input: RowFormInput) => void
}

function nextSide(side: RowSide | null): RowSide | null {
  if (side === 'rs') return 'ws'
  if (side === 'ws') return 'rs'
  return null
}

export function RowSheet({ open, onClose, mode, showSide, initialNumber, initialSide, initialText, initialStitchesAfter, onSave }: RowSheetProps) {
  const [number, setNumber] = useState(initialNumber != null ? String(initialNumber) : '')
  const [side, setSide] = useState<RowSide | null>(initialSide)
  const [text, setText] = useState(initialText ?? '')
  const [stitchesAfter, setStitchesAfter] = useState(initialStitchesAfter != null ? String(initialStitchesAfter) : '')

  useEffect(() => {
    if (!open) return
    setNumber(initialNumber != null ? String(initialNumber) : '')
    setSide(initialSide)
    setText(initialText ?? '')
    setStitchesAfter(initialStitchesAfter != null ? String(initialStitchesAfter) : '')
    // Deliberately only reacts to `open`: once open, "ajouter le suivant"
    // manages number/side/text itself below, without fighting the parent's
    // (stale) initial* props.
  }, [open])

  function currentInput(): RowFormInput {
    return {
      number: number.trim() === '' ? null : Number.parseInt(number, 10),
      side: showSide ? side : null,
      text,
      stitchesAfter: stitchesAfter.trim() === '' ? null : Number.parseInt(stitchesAfter, 10),
    }
  }

  function handleSaveAndClose() {
    onSave(currentInput())
    onClose()
  }

  function handleSaveAndAddNext() {
    const saved = currentInput()
    onSave(saved)
    setNumber(saved.number != null ? String(saved.number + 1) : '')
    setSide(showSide ? nextSide(saved.side) : null)
    setText('')
    setStitchesAfter('')
  }

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'create' ? 'Ajouter un rang' : 'Modifier le rang'}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          handleSaveAndClose()
        }}
      >
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Numéro</span>
            <input className={styles.input} inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} autoFocus />
          </label>
          {showSide && (
            <div className={styles.field}>
              <span className={styles.label}>Côté</span>
              <div className={styles.radioGroup}>
                <button type="button" className={side === 'rs' ? styles.radioOptionActive : styles.radioOption} onClick={() => setSide(side === 'rs' ? null : 'rs')}>
                  END
                </button>
                <button type="button" className={side === 'ws' ? styles.radioOptionActive : styles.radioOption} onClick={() => setSide(side === 'ws' ? null : 'ws')}>
                  ENV
                </button>
              </div>
            </div>
          )}
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Texte du rang</span>
          <textarea className={styles.textarea} value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="*2 m end, 2 m env* rép." />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Mailles après ce rang (optionnel)</span>
          <input className={styles.input} inputMode="numeric" value={stitchesAfter} onChange={(event) => setStitchesAfter(event.target.value)} />
        </label>
        <Button type="submit" size="lg">
          Enregistrer
        </Button>
        {mode === 'create' && (
          <Button type="button" variant="secondary" size="lg" onClick={handleSaveAndAddNext}>
            Enregistrer et ajouter le suivant
          </Button>
        )}
      </form>
    </Sheet>
  )
}
