import { useState } from 'react'
import styles from './TextPromptSheet.module.css'
import { Button, Sheet } from '../ui'

interface TextPromptSheetProps {
  title: string
  initialValue?: string
  placeholder?: string
  saveLabel?: string
  onClose: () => void
  onSave: (value: string) => void
}

// Shared free-text input sheet: renaming a counter and creating a new one
// only differ in title/placeholder/initial value. Mounted only while open
// (see CounterPage), so a useState initializer is enough — no reset effect.
export function TextPromptSheet({
  title,
  initialValue = '',
  placeholder,
  saveLabel = 'Enregistrer',
  onClose,
  onSave,
}: TextPromptSheetProps) {
  const [value, setValue] = useState(initialValue)

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSave(trimmed)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <input
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
      />
      <Button className={styles.saveButton} onClick={handleSave} disabled={!value.trim()}>
        {saveLabel}
      </Button>
    </Sheet>
  )
}
