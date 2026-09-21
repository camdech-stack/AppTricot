import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import styles from '../CreateGuideSheet.module.css'
import { Sheet, Button } from '../../ui'
import { CRAFT_LABELS } from '../../projects/statusMeta'
import type { GuideRecord, PatternRecord, ProjectCraft } from '../../../data'

interface GuideMetaSheetProps {
  open: boolean
  onClose: () => void
  guide: GuideRecord
  patterns: PatternRecord[]
  onSave: (input: { name: string; craft: ProjectCraft | null; patternId: string | null; sizeLabel: string | null }) => void
}

export function GuideMetaSheet({ open, onClose, guide, patterns, onSave }: GuideMetaSheetProps) {
  const [name, setName] = useState(guide.name)
  const [craft, setCraft] = useState<ProjectCraft | ''>(guide.craft ?? '')
  const [patternId, setPatternId] = useState<string | null>(guide.patternId)
  const [sizeLabel, setSizeLabel] = useState(guide.sizeLabel ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setName(guide.name)
    setCraft(guide.craft ?? '')
    setPatternId(guide.patternId)
    setSizeLabel(guide.sizeLabel ?? '')
    setPickerOpen(false)
    setQuery('')
  }, [open, guide])

  const filteredPatterns = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return patterns
    return patterns.filter((pattern) => pattern.name.toLowerCase().includes(needle))
  }, [patterns, query])

  const selectedPattern = patterns.find((pattern) => pattern.id === patternId)

  return (
    <Sheet open={open} onClose={onClose} title="Modifier le guide">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onSave({ name: name.trim(), craft: craft || null, patternId, sizeLabel: sizeLabel.trim() || null })
          onClose()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nom</span>
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Type</span>
          <select className={styles.input} value={craft} onChange={(event) => setCraft(event.target.value as ProjectCraft | '')}>
            <option value="">—</option>
            <option value="knitting">{CRAFT_LABELS.knitting}</option>
            <option value="crochet">{CRAFT_LABELS.crochet}</option>
          </select>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Patron associé</span>
          <button type="button" className={styles.pickerButton} onClick={() => setPickerOpen((value) => !value)}>
            {selectedPattern ? selectedPattern.name : 'Aucun patron'}
          </button>
          {pickerOpen && (
            <div className={styles.pickerPanel}>
              <input className={styles.searchInput} type="search" placeholder="Rechercher un patron…" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
              <div className={styles.pickerList}>
                <button
                  type="button"
                  className={styles.pickerItem}
                  onClick={() => {
                    setPatternId(null)
                    setPickerOpen(false)
                  }}
                >
                  <span>Aucun patron</span>
                  {patternId === null && <Check size={16} strokeWidth={2} />}
                </button>
                {filteredPatterns.map((pattern) => (
                  <button
                    key={pattern.id}
                    type="button"
                    className={styles.pickerItem}
                    onClick={() => {
                      setPatternId(pattern.id)
                      setPickerOpen(false)
                    }}
                  >
                    <span>{pattern.name}</span>
                    {patternId === pattern.id && <Check size={16} strokeWidth={2} />}
                  </button>
                ))}
                {filteredPatterns.length === 0 && <p className={styles.pickerEmpty}>Aucun patron ne correspond.</p>}
              </div>
            </div>
          )}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Taille</span>
          <input className={styles.input} value={sizeLabel} onChange={(event) => setSizeLabel(event.target.value)} placeholder="M" />
        </label>

        <Button type="submit" size="lg" disabled={!name.trim()}>
          Enregistrer
        </Button>
      </form>
    </Sheet>
  )
}
