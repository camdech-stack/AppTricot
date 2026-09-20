import { useState } from 'react'
import styles from './YarnSheetForm.module.css'
import { Sheet, Button } from '../ui'
import { updateYarn, type YarnRecord } from '../../data'

interface AdjustStockSheetProps {
  open: boolean
  onClose: () => void
  yarn: YarnRecord
}

// "J'ai acheté / retiré des pelotes": adjusts the yarn's own initial
// quantity (skeinCount), distinct from a consumption entry.
export function AdjustStockSheet({ open, onClose, yarn }: AdjustStockSheetProps) {
  const [amount, setAmount] = useState('1')
  const [saving, setSaving] = useState(false)

  async function apply(direction: 1 | -1) {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0 || saving) return
    setSaving(true)
    try {
      const next = Math.max(0, yarn.skeinCount + direction * parsed)
      await updateYarn(yarn.id, { skeinCount: next })
      setAmount('1')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Acheter / retirer des pelotes">
      <label className={styles.field}>
        <span className={styles.label}>Nombre de pelotes</span>
        <input
          className={styles.input}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => void apply(-1)}>
          Retirer
        </Button>
        <Button type="button" disabled={saving} onClick={() => void apply(1)}>
          Ajouter
        </Button>
      </div>
    </Sheet>
  )
}
