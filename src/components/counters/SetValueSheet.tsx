import { useState } from 'react'
import styles from './SetValueSheet.module.css'
import { Button, Sheet } from '../ui'

interface SetValueSheetProps {
  currentValue: number
  onClose: () => void
  onSave: (value: number) => void
}

// Mounted only while its sheet is open (see CounterPage): a plain useState
// initializer is enough to seed the field, no reset-on-reopen effect needed.
export function SetValueSheet({ currentValue, onClose, onSave }: SetValueSheetProps) {
  const [value, setValue] = useState(String(currentValue))

  function handleSave() {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    onSave(Math.max(0, Math.round(parsed)))
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Définir la valeur">
      <input
        type="number"
        inputMode="numeric"
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
      />
      <Button className={styles.saveButton} onClick={handleSave}>
        Enregistrer
      </Button>
    </Sheet>
  )
}
