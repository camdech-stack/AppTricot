import styles from './YarnFilterSheet.module.css'
import { Sheet, Button } from '../ui'
import { COLOR_FAMILY_LABELS, COLOR_FAMILY_OPTIONS, WEIGHT_CATEGORY_LABELS, WEIGHT_CATEGORY_OPTIONS } from './yarnMeta'
import { metersToYards, yardsToMeters } from '../../data/yarnMath'
import { DEFAULT_YARN_FILTERS, type LengthUnit, type YarnListFilters } from '../../data'
import type { ProjectRecord } from '../../data'

interface YarnFilterSheetProps {
  open: boolean
  onClose: () => void
  filters: YarnListFilters
  onChange: (filters: YarnListFilters) => void
  projects: ProjectRecord[]
  lengthUnit: LengthUnit
}

const STOCK_STATE_OPTIONS: { value: YarnListFilters['stockState']; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'in_stock', label: 'En stock' },
  { value: 'exhausted', label: 'Épuisé' },
]

export function YarnFilterSheet({ open, onClose, filters, onChange, projects, lengthUnit }: YarnFilterSheetProps) {
  function patch(next: Partial<YarnListFilters>) {
    onChange({ ...filters, ...next })
  }

  // minMetersPerSkein is always stored in meters; the field is edited in the
  // app's chosen length unit and converted at the boundary.
  const minMetersDisplay =
    filters.minMetersPerSkein === null
      ? ''
      : lengthUnit === 'yd'
        ? Math.round(metersToYards(filters.minMetersPerSkein))
        : filters.minMetersPerSkein

  return (
    <Sheet open={open} onClose={onClose} title="Filtrer la laine">
      <div className={styles.field}>
        <span className={styles.label}>Épaisseur</span>
        <select
          className={styles.select}
          value={filters.weightCategory}
          onChange={(event) => patch({ weightCategory: event.target.value as YarnListFilters['weightCategory'] })}
        >
          <option value="all">Toutes</option>
          {WEIGHT_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {WEIGHT_CATEGORY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Famille de couleur</span>
        <select
          className={styles.select}
          value={filters.colorFamily}
          onChange={(event) => patch({ colorFamily: event.target.value as YarnListFilters['colorFamily'] })}
        >
          <option value="all">Toutes</option>
          {COLOR_FAMILY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {COLOR_FAMILY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Projet associé</span>
        <select
          className={styles.select}
          value={filters.projectId}
          onChange={(event) => patch({ projectId: event.target.value })}
        >
          <option value="all">Tous</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Disponibilité</span>
        <div className={styles.segmented} role="group" aria-label="Disponibilité">
          {STOCK_STATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.stockState === option.value}
              onClick={() => patch({ stockState: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Métrage minimum par pelote ({lengthUnit === 'yd' ? 'yd' : 'm'})</span>
        <input
          className={styles.input}
          type="number"
          inputMode="decimal"
          min={0}
          value={minMetersDisplay}
          onChange={(event) => {
            if (event.target.value === '') {
              patch({ minMetersPerSkein: null })
              return
            }
            const entered = Number(event.target.value)
            patch({ minMetersPerSkein: lengthUnit === 'yd' ? yardsToMeters(entered) : entered })
          }}
        />
      </label>

      <Button variant="ghost" className={styles.resetButton} onClick={() => onChange(DEFAULT_YARN_FILTERS)}>
        Réinitialiser les filtres
      </Button>
    </Sheet>
  )
}
