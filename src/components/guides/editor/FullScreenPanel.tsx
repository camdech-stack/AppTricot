import { useState, type ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import styles from './FullScreenPanel.module.css'
import { PdfViewerCore } from '../../patterns/PdfViewerCore'

export interface LinkedPatternRef {
  id: string
  name: string
}

interface FullScreenPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  // When the guide has a linked pattern, shows a quick-access button that
  // opens it full-screen on top of this panel — see CLAUDE.md "Volet patron
  // dans l'éditeur" and the retour utilisateur asking for the same shortcut
  // from inside piece/section/bloc edit sheets, not just the Guide|Patron
  // pill. Closing the PDF returns to this same panel, untouched.
  linkedPattern?: LinkedPatternRef | null
}

// Full-screen editor for a piece/section/block: slides in from the right
// instead of the bottom Sheet used elsewhere, per the retour utilisateur.
// No input inside ever sets autoFocus, so opening it never pops the
// keyboard on its own. The close button says "Fermer", matching Sheet's
// own close button elsewhere — not "Annuler", which the editor's header
// already uses for Undo and shouldn't share an accessible name with.
export function FullScreenPanel({ open, onClose, title, children, linkedPattern }: FullScreenPanelProps) {
  const [pdfOpen, setPdfOpen] = useState(false)

  if (!open) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Fermer
          </button>
          <h2 className={styles.title}>{title}</h2>
          {linkedPattern ? (
            <button type="button" className={styles.pdfButton} aria-label="Voir le patron" onClick={() => setPdfOpen(true)}>
              <BookOpen size={20} strokeWidth={1.75} />
            </button>
          ) : (
            <span className={styles.headerSpacer} aria-hidden="true" />
          )}
        </div>
        <div className={styles.body}>{children}</div>
      </div>

      {linkedPattern && pdfOpen && (
        <div className={styles.pdfOverlay}>
          <PdfViewerCore patternId={linkedPattern.id} projectId={null} patternName={linkedPattern.name} onBack={() => setPdfOpen(false)} />
        </div>
      )}
    </div>
  )
}
