import { useState } from 'react'
import styles from './GoalSheet.module.css'
import { Button, Sheet } from '../ui'

interface GoalSheetProps {
  currentGoal: number | null
  onClose: () => void
  onSave: (goal: number | null) => void
}

// Mounted only while its sheet is open (see CounterPage): a plain useState
// initializer is enough to seed the field, no reset-on-reopen effect needed.
export function GoalSheet({ currentGoal, onClose, onSave }: GoalSheetProps) {
  const [value, setValue] = useState(currentGoal != null ? String(currentGoal) : '')

  function handleSave() {
    const parsed = value.trim() === '' ? null : Number(value)
    onSave(parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null)
    onClose()
  }

  function handleRemove() {
    onSave(null)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Objectif">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Nombre de rangs"
        autoFocus
      />
      <div className={styles.actions}>
        <Button onClick={handleSave}>Enregistrer</Button>
        {currentGoal != null && (
          <Button variant="ghost" onClick={handleRemove}>
            Retirer l'objectif
          </Button>
        )}
      </div>
    </Sheet>
  )
}
