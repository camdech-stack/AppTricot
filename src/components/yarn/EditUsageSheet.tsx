import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import styles from './YarnSheetForm.module.css'
import { Sheet, Button, ConfirmDialog } from '../ui'
import { displayValueToStored, storedUnitLabel, storedValueToDisplay } from './quantityInput'
import { deleteYarnUsage, updateYarnUsage, type LengthUnit, type YarnUsageRecord } from '../../data'

interface EditUsageSheetProps {
  open: boolean
  onClose: () => void
  usage: YarnUsageRecord
  lengthUnit: LengthUnit
}

export function EditUsageSheet({ open, onClose, usage, lengthUnit }: EditUsageSheetProps) {
  const [value, setValue] = useState(String(storedValueToDisplay(usage.value, usage.unit, lengthUnit)))
  const [usedAt, setUsedAt] = useState(usage.usedAt)
  const [note, setNote] = useState(usage.note)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  async function handleSave() {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0 || saving) return
    setSaving(true)
    try {
      await updateYarnUsage(usage.id, { value: displayValueToStored(parsed, usage.unit, lengthUnit), usedAt, note })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await deleteYarnUsage(usage.id)
    setDeleteConfirmOpen(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Modifier la consommation">
      <label className={styles.field}>
        <span className={styles.label}>Quantité ({storedUnitLabel(usage.unit, lengthUnit)})</span>
        <input
          className={styles.input}
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Date</span>
        <input className={styles.input} type="date" value={usedAt} onChange={(event) => setUsedAt(event.target.value)} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Note</span>
        <input className={styles.input} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" icon={<Trash2 size={18} strokeWidth={1.75} />} onClick={() => setDeleteConfirmOpen(true)}>
          Supprimer
        </Button>
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          Enregistrer
        </Button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer la consommation"
        message="Cette quantité sera remise en stock. Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </Sheet>
  )
}
