import styles from './PatternFilterSheet.module.css'
import { Sheet, Button } from '../ui'
import { CRAFT_LABELS } from '../projects/statusMeta'
import { DEFAULT_PATTERN_FILTERS, type PatternListFilters } from '../../data'

interface PatternFilterSheetProps {
  open: boolean
  onClose: () => void
  filters: PatternListFilters
  onChange: (filters: PatternListFilters) => void
  allTags: string[]
}

const CRAFT_OPTIONS: { value: PatternListFilters['craft']; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'knitting', label: CRAFT_LABELS.knitting },
  { value: 'crochet', label: CRAFT_LABELS.crochet },
]

const LINKED_OPTIONS: { value: PatternListFilters['linked']; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'linked', label: 'Associé' },
  { value: 'unlinked', label: 'Non associé' },
]

export function PatternFilterSheet({ open, onClose, filters, onChange, allTags }: PatternFilterSheetProps) {
  function patch(next: Partial<PatternListFilters>) {
    onChange({ ...filters, ...next })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Filtrer les patrons">
      <div className={styles.field}>
        <span className={styles.label}>Type</span>
        <div className={styles.segmented} role="group" aria-label="Type">
          {CRAFT_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filters.craft === option.value} onClick={() => patch({ craft: option.value })}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Tag</span>
        <select className={styles.select} value={filters.tag} onChange={(event) => patch({ tag: event.target.value })}>
          <option value="all">Tous</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Associé à un projet</span>
        <div className={styles.segmented} role="group" aria-label="Associé à un projet">
          {LINKED_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filters.linked === option.value} onClick={() => patch({ linked: option.value })}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Button variant="ghost" className={styles.resetButton} onClick={() => onChange(DEFAULT_PATTERN_FILTERS)}>
        Réinitialiser les filtres
      </Button>
    </Sheet>
  )
}
