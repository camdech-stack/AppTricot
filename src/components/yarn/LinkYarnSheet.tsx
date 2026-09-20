import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import styles from './YarnSheetForm.module.css'
import { Sheet, Button } from '../ui'
import { quantityUnitLabel, resolveQuantityInput, storedUnitLabel, storedValueToDisplay, type QuantityUnitChoice } from './quantityInput'
import { linkYarnToProject, unlinkYarnFromProject, type LengthUnit, type ProjectYarnRecord, type YarnRecord } from '../../data'

interface LinkYarnSheetProps {
  open: boolean
  onClose: () => void
  projectId: string
  yarns: YarnRecord[]
  lengthUnit: LengthUnit
  // When set, edits this existing link instead of creating a new one — the
  // yarn picker is hidden and a "Retirer" action becomes available.
  editingLink?: ProjectYarnRecord
}

export function LinkYarnSheet({ open, onClose, projectId, yarns, lengthUnit, editingLink }: LinkYarnSheetProps) {
  const editingYarn = editingLink ? yarns.find((yarn) => yarn.id === editingLink.yarnId) : undefined
  const [query, setQuery] = useState('')
  const [selectedYarnId, setSelectedYarnId] = useState<string>(editingLink?.yarnId ?? '')
  const [value, setValue] = useState(editingLink ? String(storedValueToDisplay(editingLink.plannedValue, editingLink.plannedUnit, lengthUnit)) : '')
  const [unitChoice, setUnitChoice] = useState<QuantityUnitChoice>(
    editingLink ? (editingLink.plannedUnit === 'm' ? 'length' : editingLink.plannedUnit) : 'g',
  )
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const filteredYarns = useMemo(() => {
    if (editingLink) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return yarns
    return yarns.filter((yarn) => [yarn.name, yarn.brand, yarn.colorName].some((field) => field.toLowerCase().includes(needle)))
  }, [yarns, query, editingLink])

  async function handleSubmit() {
    if (!selectedYarnId) {
      setError('Choisissez un fil.')
      return
    }
    const resolved = resolveQuantityInput(value, unitChoice, lengthUnit)
    if (!resolved || resolved.value <= 0) {
      setError('Indiquez une quantité prévue valide.')
      return
    }
    setSaving(true)
    try {
      await linkYarnToProject(projectId, selectedYarnId, resolved.value, resolved.unit)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleUnlink() {
    if (!editingLink) return
    setSaving(true)
    try {
      await unlinkYarnFromProject(editingLink.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editingLink ? 'Modifier la quantité prévue' : 'Ajouter un fil'}>
      {editingYarn && <p className={styles.label}>{editingYarn.name}</p>}

      {!editingLink && (
        <>
          <input
            className={`${styles.input} ${styles.searchInput}`}
            type="search"
            placeholder="Rechercher un fil…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.pickerList}>
            {filteredYarns.map((yarn) => (
              <button
                key={yarn.id}
                type="button"
                className={styles.pickerItem}
                aria-pressed={selectedYarnId === yarn.id}
                onClick={() => setSelectedYarnId(yarn.id)}
              >
                <span className={styles.pickerItemName}>{yarn.name}</span>
                <span className={styles.pickerItemMeta}>{[yarn.brand, yarn.colorName].filter(Boolean).join(' · ') || '—'}</span>
              </button>
            ))}
            {filteredYarns.length === 0 && <p className={styles.label}>Aucun fil ne correspond.</p>}
          </div>
        </>
      )}

      <div className={styles.field}>
        <span className={styles.label}>Quantité prévue</span>
        <div className={styles.quantityRow}>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            min={0}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {editingLink ? (
            <span className={styles.select}>{storedUnitLabel(editingLink.plannedUnit, lengthUnit)}</span>
          ) : (
            <select className={styles.select} value={unitChoice} onChange={(event) => setUnitChoice(event.target.value as QuantityUnitChoice)}>
              <option value="g">{quantityUnitLabel('g', lengthUnit)}</option>
              <option value="length">{quantityUnitLabel('length', lengthUnit)}</option>
              <option value="skein">{quantityUnitLabel('skein', lengthUnit)}</option>
            </select>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        {editingLink && (
          <Button type="button" variant="ghost" icon={<Trash2 size={18} strokeWidth={1.75} />} disabled={saving} onClick={() => void handleUnlink()}>
            Retirer
          </Button>
        )}
        <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}
