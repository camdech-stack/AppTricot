import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Sheet.module.css'
import { IconButton } from './IconButton'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

// Generic bottom sheet used for every counter menu/editor (rename, goal,
// manual value, history, confirmations): one modal shell so each of those
// only has to provide its own content.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <IconButton icon={<X strokeWidth={1.75} />} label="Fermer" onClick={onClose} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
