import { History, Pencil, SlidersHorizontal, Target, Trash2 } from 'lucide-react'
import styles from './CounterMenuSheet.module.css'
import { Sheet } from '../ui'

interface CounterMenuSheetProps {
  open: boolean
  onClose: () => void
  isMain: boolean
  onRename: () => void
  onSetGoal: () => void
  onSetValue: () => void
  onShowHistory: () => void
  onDelete: () => void
}

export function CounterMenuSheet({
  open,
  onClose,
  isMain,
  onRename,
  onSetGoal,
  onSetValue,
  onShowHistory,
  onDelete,
}: CounterMenuSheetProps) {
  function handle(action: () => void) {
    onClose()
    action()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Compteur">
      <div className={styles.list}>
        <button type="button" className={styles.item} onClick={() => handle(onRename)}>
          <Pencil size={20} strokeWidth={1.75} />
          Renommer
        </button>
        <button type="button" className={styles.item} onClick={() => handle(onSetGoal)}>
          <Target size={20} strokeWidth={1.75} />
          Définir l'objectif
        </button>
        <button type="button" className={styles.item} onClick={() => handle(onSetValue)}>
          <SlidersHorizontal size={20} strokeWidth={1.75} />
          Définir la valeur
        </button>
        <button type="button" className={styles.item} onClick={() => handle(onShowHistory)}>
          <History size={20} strokeWidth={1.75} />
          Historique
        </button>
        {!isMain && (
          <button type="button" className={styles.itemDanger} onClick={() => handle(onDelete)}>
            <Trash2 size={20} strokeWidth={1.75} />
            Supprimer
          </button>
        )}
      </div>
    </Sheet>
  )
}
