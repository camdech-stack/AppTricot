import { useState } from 'react'
import styles from './YarnSheetForm.module.css'
import { Sheet, Button } from '../ui'
import { quantityUnitLabel, resolveQuantityInput, type QuantityUnitChoice } from './quantityInput'
import { addYarnUsage, todayDateString, type LengthUnit, type ProjectRecord, type YarnRecord } from '../../data'

// Either a fixed yarn with a free choice of project (opened from a yarn's
// own detail page), or a fixed project with a choice of yarn among the ones
// it's linked to (opened from a project's "Laine" card).
type LogUsageSheetProps = {
  open: boolean
  onClose: () => void
  lengthUnit: LengthUnit
} & (
  | { yarn: YarnRecord; projects: ProjectRecord[]; defaultProjectId?: string | null; pickableYarns?: undefined; project?: undefined }
  | { pickableYarns: YarnRecord[]; project: ProjectRecord; yarn?: undefined; projects?: undefined; defaultProjectId?: undefined }
)

export function LogUsageSheet(props: LogUsageSheetProps) {
  const { open, onClose, lengthUnit } = props
  const fixedYarn = props.yarn
  const [selectedYarnId, setSelectedYarnId] = useState(props.pickableYarns?.[0]?.id ?? '')
  const [projectId, setProjectId] = useState<string>(fixedYarn ? (props.defaultProjectId ?? '') : props.project.id)
  const [value, setValue] = useState('')
  const [unitChoice, setUnitChoice] = useState<QuantityUnitChoice>('g')
  const [usedAt, setUsedAt] = useState(todayDateString())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const targetYarn = fixedYarn ?? props.pickableYarns?.find((candidate) => candidate.id === selectedYarnId)

  async function handleSubmit() {
    if (!targetYarn) {
      setError('Choisissez un fil.')
      return
    }
    const resolved = resolveQuantityInput(value, unitChoice, lengthUnit)
    if (!resolved || resolved.value <= 0) {
      setError('Indiquez une quantité valide.')
      return
    }
    setSaving(true)
    try {
      await addYarnUsage({
        yarnId: targetYarn.id,
        projectId: projectId || null,
        value: resolved.value,
        unit: resolved.unit,
        usedAt,
        note,
      })
      setValue('')
      setNote('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Enregistrer une consommation">
      {props.pickableYarns && (
        <label className={styles.field}>
          <span className={styles.label}>Fil</span>
          <select className={styles.select} value={selectedYarnId} onChange={(event) => setSelectedYarnId(event.target.value)}>
            {props.pickableYarns.map((yarn) => (
              <option key={yarn.id} value={yarn.id}>
                {yarn.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {fixedYarn && (
        <label className={styles.field}>
          <span className={styles.label}>Projet</span>
          <select className={styles.select} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Aucun projet</option>
            {props.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.field}>
        <span className={styles.label}>Quantité consommée</span>
        <div className={styles.quantityRow}>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            min={0}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <select className={styles.select} value={unitChoice} onChange={(event) => setUnitChoice(event.target.value as QuantityUnitChoice)}>
            <option value="g">{quantityUnitLabel('g', lengthUnit)}</option>
            <option value="length">{quantityUnitLabel('length', lengthUnit)}</option>
            <option value="skein">{quantityUnitLabel('skein', lengthUnit)}</option>
          </select>
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Date</span>
        <input className={styles.input} type="date" value={usedAt} onChange={(event) => setUsedAt(event.target.value)} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Note</span>
        <input className={styles.input} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
        Enregistrer
      </Button>
    </Sheet>
  )
}
