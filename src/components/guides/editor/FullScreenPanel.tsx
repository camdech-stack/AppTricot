import type { ReactNode } from 'react'
import styles from './FullScreenPanel.module.css'

interface FullScreenPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

// Full-screen editor for a piece/section/block: slides in from the right
// instead of the bottom Sheet used elsewhere, per the retour utilisateur.
// No input inside ever sets autoFocus, so opening it never pops the
// keyboard on its own. The close button says "Fermer", matching Sheet's
// own close button elsewhere — not "Annuler", which the editor's header
// already uses for Undo and shouldn't share an accessible name with.
export function FullScreenPanel({ open, onClose, title, children }: FullScreenPanelProps) {
  if (!open) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Fermer
          </button>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
