import { CheckCheck, ListTree, Pencil, Timer } from 'lucide-react'
import styles from '../editor/NodeMenuSheet.module.css'
import { Sheet } from '../../ui'

interface GuideFollowMenuSheetProps {
  open: boolean
  onClose: () => void
  onOpenLinkedCounter: () => void
  onOpenPlan: () => void
  onCorrect: () => void
  canCorrect: boolean
  // "Terminer ce bloc maintenant" only makes sense while inside a
  // measure/stitch_count block — see CLAUDE.md "Point de contrôle".
  onFinishBlock: () => void
  canFinishBlock: boolean
}

// The follow screen's "⋯" menu (see CLAUDE.md "Écran de suivi"). Corriger
// and Terminer ce bloc live here rather than as buttons on the instruction
// card, so that card stays as plain as the step's own text — see CLAUDE.md
// "Décisions d'interface (étape 5b, refonte visuelle)". "Recommencer cette
// pièce/le guide" live in the plan sheet instead, next to the piece they
// act on.
export function GuideFollowMenuSheet({
  open,
  onClose,
  onOpenLinkedCounter,
  onOpenPlan,
  onCorrect,
  canCorrect,
  onFinishBlock,
  canFinishBlock,
}: GuideFollowMenuSheetProps) {
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
        {canFinishBlock && (
          <button type="button" className={styles.item} onClick={() => handle(onFinishBlock)}>
            <CheckCheck size={20} strokeWidth={1.75} />
            Terminer ce bloc maintenant
          </button>
        )}
      </div>
    </Sheet>
  )
}
