import { ListTree, Pencil, Timer } from 'lucide-react'
import styles from '../editor/NodeMenuSheet.module.css'
import { Sheet } from '../../ui'

interface GuideFollowMenuSheetProps {
  open: boolean
  onClose: () => void
  onOpenLinkedCounter: () => void
  onOpenPlan: () => void
  onCorrect: () => void
  canCorrect: boolean
}

// The follow screen's "⋯" menu (see CLAUDE.md "Écran de suivi").
// "Recommencer cette pièce/le guide" live in the plan sheet instead, next
// to the piece they act on.
export function GuideFollowMenuSheet({ open, onClose, onOpenLinkedCounter, onOpenPlan, onCorrect, canCorrect }: GuideFollowMenuSheetProps) {
  function handle(action: () => void) {
    onClose()
    action()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Guide">
      <div className={styles.list}>
        <button type="button" className={styles.item} onClick={() => handle(onOpenLinkedCounter)}>
          <Timer size={20} strokeWidth={1.75} />
          Compter aussi dans un compteur du projet
        </button>
        <button type="button" className={styles.item} onClick={() => handle(onOpenPlan)}>
          <ListTree size={20} strokeWidth={1.75} />
          Plan du guide
        </button>
        <button type="button" className={styles.item} disabled={!canCorrect} onClick={() => handle(onCorrect)}>
          <Pencil size={20} strokeWidth={1.75} />
          Corriger le pas actuel
        </button>
      </div>
    </Sheet>
  )
}
