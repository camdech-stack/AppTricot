import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import styles from './FormSheet.module.css'
import ownStyles from './PasteRowsSheet.module.css'
import { Sheet, Button, Pill } from '../../ui'
import { parsePastedRows, type ParsedRow } from '../../../data'

interface PasteRowsSheetProps {
  open: boolean
  onClose: () => void
  startingNumber: number
  onConfirm: (rows: ParsedRow[]) => void
}

// A live preview driven straight from the pasted text: editing the text
// re-parses on every change, and each preview row can also be dropped
// individually before confirming — see CLAUDE.md "Coller plusieurs rangs".
export function PasteRowsSheet({ open, onClose, startingNumber, onConfirm }: PasteRowsSheetProps) {
  const [text, setText] = useState('')
  const [excludedLines, setExcludedLines] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) {
      setText('')
      setExcludedLines(new Set())
    }
  }, [open])

  const lines = useMemo(() => text.split(/\r?\n/).filter((line) => line.trim().length > 0), [text])
  const parsed = useMemo(() => parsePastedRows(text, startingNumber), [text, startingNumber])
  const kept = parsed.filter((_, index) => !excludedLines.has(index))

  return (
    <Sheet open={open} onClose={onClose} title="Coller plusieurs rangs">
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Texte collé (un rang par ligne)</span>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setExcludedLines(new Set())
            }}
            rows={6}
            autoFocus
            placeholder={'Rang 1 : *2 m end, 2 m env* rép\nRang 2 : tout en env'}
          />
        </label>

        {lines.length > 0 && (
          <div className={ownStyles.preview}>
            {parsed.map((row, index) => (
              <div key={index} className={excludedLines.has(index) ? ownStyles.previewRowExcluded : ownStyles.previewRow}>
                <span className={ownStyles.previewNumber}>{row.number ?? '—'}</span>
                {row.side && <Pill color={row.side === 'rs' ? 'primary' : 'blue'}>{row.side === 'rs' ? 'END' : 'ENV'}</Pill>}
                <span className={ownStyles.previewText}>{row.text || '(vide)'}</span>
                <button
                  type="button"
                  className={ownStyles.previewRemove}
                  aria-label="Retirer ce rang"
                  onClick={() =>
                    setExcludedLines((current) => {
                      const next = new Set(current)
                      if (next.has(index)) next.delete(index)
                      else next.add(index)
                      return next
                    })
                  }
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          size="lg"
          disabled={kept.length === 0}
          onClick={() => {
            onConfirm(kept)
            onClose()
          }}
        >
          Ajouter {kept.length > 0 ? `${kept.length} rang${kept.length > 1 ? 's' : ''}` : 'les rangs'}
        </Button>
      </div>
    </Sheet>
  )
}
