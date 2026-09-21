import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './CreateGuideSheet.module.css'
import { Sheet, Button } from '../ui'
import { CRAFT_LABELS } from '../projects/statusMeta'
import { createGuide, type GuideRecord, type PatternRecord, type ProjectCraft } from '../../data'

interface CreateGuideSheetProps {
  open: boolean
  onClose: () => void
  onCreated: (guide: GuideRecord) => void
  patterns: PatternRecord[]
  // Prefilled when creating a guide from a project or a pattern's own page
  // (see CLAUDE.md "Fiche projet, carte Guide de patron").
  defaultCraft?: ProjectCraft | null
  defaultPatternId?: string | null
}

export function CreateGuideSheet({ open, onClose, onCreated, patterns, defaultCraft, defaultPatternId }: CreateGuideSheetProps) {
  const [name, setName] = useState('')
  const [craft, setCraft] = useState<ProjectCraft | ''>('')
  const [patternId, setPatternId] = useState<string | null>(null)
  const [sizeLabel, setSizeLabel] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setCraft(defaultCraft ?? '')
    setPatternId(defaultPatternId ?? null)
    setSizeLabel('')
    setPickerOpen(false)
    setQuery('')
  }, [open, defaultCraft, defaultPatternId])

  const filteredPatterns = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return patterns
    return patterns.filter((pattern) => pattern.name.toLowerCase().includes(needle))
  }, [patterns, query])

  const selectedPattern = patterns.find((pattern) => pattern.id === patternId)

  async function handleSubmit() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const guide = await createGuide({
        name: name.trim(),
        craft: craft || null,
        patternId,
        sizeLabel: sizeLabel.trim() || null,
      })
      onCreated(guide)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Créer un guide">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Nom</span>
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Pull torsades" required autoFocus />
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
          <span className={styles.label}>Patron associé (optionnel)</span>
          <button type="button" className={styles.pickerButton} onClick={() => setPickerOpen((value) => !value)}>
            {selectedPattern ? selectedPattern.name : 'Aucun patron'}
          </button>
          {pickerOpen && (
            <div className={styles.pickerPanel}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Rechercher un patron…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
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
          <span className={styles.label}>Taille (optionnel)</span>
          <input className={styles.input} value={sizeLabel} onChange={(event) => setSizeLabel(event.target.value)} placeholder="M" />
        </label>

        <Button type="submit" size="lg" disabled={saving || !name.trim()}>
          {saving ? 'Création…' : 'Créer le guide'}
        </Button>
      </form>
    </Sheet>
  )
}
