// Small edit sheets for the tree nodes that just need a plain form: a
// piece's name/notes, a montage/finition operation, a section's name and
// method, and the four "simple" block types (text/repeat/measure/
// stitch_count). Rows and pasted rows get their own file since they carry
// more specific logic (RowSheet.tsx, PasteRowsSheet.tsx).
import { useEffect, useState } from 'react'
import styles from './FormSheet.module.css'
import { Sheet, Button } from '../../ui'
import { JOIN_MODE_LABELS, OPERATION_KIND_LABELS } from './operationMeta'
import {
  CAST_ON_OPERATION_KINDS,
  FINISH_OPERATION_KINDS,
  type JoinMode,
  type MeasureUnit,
  type Operation,
  type OperationKind,
  type SectionMethod,
  type SetOperationInput,
} from '../../../data'

const SECTION_NAME_SUGGESTIONS = [
  'Côtes / ourlet',
  'Corps / motif principal',
  'Façonnage de la taille',
  'Façonnage de l’emmanchure',
  'Façonnage des épaules',
  'Encolure',
]

// --- Piece --------------------------------------------------------------

interface PieceSheetProps {
  open: boolean
  onClose: () => void
  initialName: string
  initialNotes: string
  onSave: (input: { name: string; notes: string }) => void
}

export function PieceSheet({ open, onClose, initialName, initialNotes, onSave }: PieceSheetProps) {
  const [name, setName] = useState(initialName)
  const [notes, setNotes] = useState(initialNotes)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setNotes(initialNotes)
    }
  }, [open, initialName, initialNotes])

  return (
    <Sheet open={open} onClose={onClose} title="Pièce">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onSave({ name: name.trim(), notes })
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nom</span>
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Dos, devant, manche…" required autoFocus />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Notes</span>
          <textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>
        <Button type="submit" size="lg" disabled={!name.trim()}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}

// --- Operation (montage / finition) -------------------------------------

interface OperationSheetProps {
  open: boolean
  onClose: () => void
  slot: 'castOn' | 'finish'
  initial: Operation | null
  onSave: (input: SetOperationInput) => void
  onRemove?: () => void
}

export function OperationSheet({ open, onClose, slot, initial, onSave, onRemove }: OperationSheetProps) {
  const allowedKinds = slot === 'castOn' ? CAST_ON_OPERATION_KINDS : FINISH_OPERATION_KINDS
  const [kind, setKind] = useState<OperationKind>(initial?.kind ?? allowedKinds[0]!)
  const [stitches, setStitches] = useState<string>(initial?.stitches != null ? String(initial.stitches) : '')
  const [joinMode, setJoinMode] = useState<JoinMode>(initial?.joinMode ?? 'round')
  const [note, setNote] = useState(initial?.note ?? '')

  useEffect(() => {
    if (open) {
      setKind(initial?.kind ?? allowedKinds[0]!)
      setStitches(initial?.stitches != null ? String(initial.stitches) : '')
      setJoinMode(initial?.joinMode ?? 'round')
      setNote(initial?.note ?? '')
    }
  }, [open, initial, allowedKinds])

  return (
    <Sheet open={open} onClose={onClose} title={slot === 'castOn' ? 'Montage' : 'Finition'}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          onSave({
            kind,
            stitches: stitches.trim() === '' ? null : Number(stitches),
            joinMode: kind === 'join' ? joinMode : null,
            note,
          })
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Type</span>
          <select className={styles.input} value={kind} onChange={(event) => setKind(event.target.value as OperationKind)}>
            {allowedKinds.map((candidate) => (
              <option key={candidate} value={candidate}>
                {OPERATION_KIND_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Nombre de mailles (optionnel)</span>
          <input className={styles.input} inputMode="numeric" value={stitches} onChange={(event) => setStitches(event.target.value)} placeholder="80" />
        </label>
        {kind === 'join' && (
          <label className={styles.field}>
            <span className={styles.label}>Mode</span>
            <select className={styles.input} value={joinMode} onChange={(event) => setJoinMode(event.target.value as JoinMode)}>
              <option value="round">{JOIN_MODE_LABELS.round}</option>
              <option value="new_yarn">{JOIN_MODE_LABELS.new_yarn}</option>
            </select>
          </label>
        )}
        <label className={styles.field}>
          <span className={styles.label}>Note</span>
          <input className={styles.input} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <Button type="submit" size="lg">
          Enregistrer
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            Retirer cette opération
          </Button>
        )}
      </form>
    </Sheet>
  )
}

// --- Section --------------------------------------------------------------

interface SectionSheetProps {
  open: boolean
  onClose: () => void
  initialName: string
  initialMethod: SectionMethod
  onSave: (input: { name: string; method: SectionMethod }) => void
}

export function SectionSheet({ open, onClose, initialName, initialMethod, onSave }: SectionSheetProps) {
  const [name, setName] = useState(initialName)
  const [method, setMethod] = useState<SectionMethod>(initialMethod)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setMethod(initialMethod)
    }
  }, [open, initialName, initialMethod])

  return (
    <Sheet open={open} onClose={onClose} title="Section">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onSave({ name: name.trim(), method })
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nom</span>
          <input
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Corps, façonnage de la taille…"
            list="section-name-suggestions"
            required
            autoFocus
          />
          <datalist id="section-name-suggestions">
            {SECTION_NAME_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <div className={styles.field}>
          <span className={styles.label}>Méthode de travail</span>
          <div className={styles.radioGroup}>
            <button type="button" className={method === 'flat' ? styles.radioOptionActive : styles.radioOption} onClick={() => setMethod('flat')}>
              À plat
            </button>
            <button type="button" className={method === 'round' ? styles.radioOptionActive : styles.radioOption} onClick={() => setMethod('round')}>
              En rond
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" disabled={!name.trim()}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}

// --- Text block -----------------------------------------------------------

interface TextBlockSheetProps {
  open: boolean
  onClose: () => void
  initialText: string
  onSave: (text: string) => void
}

export function TextBlockSheet({ open, onClose, initialText, onSave }: TextBlockSheetProps) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    if (open) setText(initialText)
  }, [open, initialText])

  return (
    <Sheet open={open} onClose={onClose} title="Texte libre">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          onSave(text)
          onClose()
        }}
      >
        <textarea className={styles.textarea} value={text} onChange={(event) => setText(event.target.value)} rows={5} autoFocus placeholder="Instruction ou remarque…" />
        <Button type="submit" size="lg">
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}

// --- Repeat block -----------------------------------------------------------

interface RepeatSheetProps {
  open: boolean
  onClose: () => void
  initialTimes: number
  onSave: (times: number) => void
}

export function RepeatSheet({ open, onClose, initialTimes, onSave }: RepeatSheetProps) {
  const [times, setTimes] = useState(String(initialTimes))

  useEffect(() => {
    if (open) setTimes(String(initialTimes))
  }, [open, initialTimes])

  const parsed = Number.parseInt(times, 10)
  const valid = Number.isInteger(parsed) && parsed >= 1

  return (
    <Sheet open={open} onClose={onClose} title="Répétition">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid) return
          onSave(parsed)
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nombre de fois</span>
          <input className={styles.input} inputMode="numeric" value={times} onChange={(event) => setTimes(event.target.value)} required autoFocus />
        </label>
        <Button type="submit" size="lg" disabled={!valid}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}

// --- Measure block -----------------------------------------------------------

interface MeasureSheetProps {
  open: boolean
  onClose: () => void
  initialLength: number
  initialUnit: MeasureUnit
  initialFrom: string
  onSave: (input: { length: number; unit: MeasureUnit; from: string }) => void
}

export function MeasureSheet({ open, onClose, initialLength, initialUnit, initialFrom, onSave }: MeasureSheetProps) {
  const [length, setLength] = useState(String(initialLength))
  const [unit, setUnit] = useState<MeasureUnit>(initialUnit)
  const [from, setFrom] = useState(initialFrom)

  useEffect(() => {
    if (open) {
      setLength(String(initialLength))
      setUnit(initialUnit)
      setFrom(initialFrom)
    }
  }, [open, initialLength, initialUnit, initialFrom])

  const parsed = Number.parseFloat(length.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 0

  return (
    <Sheet open={open} onClose={onClose} title="Jusqu’à une longueur">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid) return
          onSave({ length: parsed, unit, from: from.trim() })
          onClose()
        }}
      >
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Longueur</span>
            <input className={styles.input} inputMode="decimal" value={length} onChange={(event) => setLength(event.target.value)} required autoFocus />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Unité</span>
            <select className={styles.input} value={unit} onChange={(event) => setUnit(event.target.value as MeasureUnit)}>
              <option value="cm">cm</option>
              <option value="in">pouces</option>
            </select>
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Depuis</span>
          <input className={styles.input} value={from} onChange={(event) => setFrom(event.target.value)} placeholder="le montage, l'emmanchure…" />
        </label>
        <Button type="submit" size="lg" disabled={!valid}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}

// --- Stitch count block -------------------------------------------------

interface StitchCountSheetProps {
  open: boolean
  onClose: () => void
  initialTarget: number
  onSave: (target: number) => void
}

export function StitchCountSheet({ open, onClose, initialTarget, onSave }: StitchCountSheetProps) {
  const [target, setTarget] = useState(String(initialTarget))

  useEffect(() => {
    if (open) setTarget(String(initialTarget))
  }, [open, initialTarget])

  const parsed = Number.parseInt(target, 10)
  const valid = Number.isInteger(parsed) && parsed >= 0

  return (
    <Sheet open={open} onClose={onClose} title="Jusqu’à un nombre de mailles">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid) return
          onSave(parsed)
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nombre de mailles cible</span>
          <input className={styles.input} inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} required autoFocus />
        </label>
        <Button type="submit" size="lg" disabled={!valid}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}
