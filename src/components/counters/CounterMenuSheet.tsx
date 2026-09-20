import { Clock, History, Pencil, SlidersHorizontal, Target, Trash2 } from 'lucide-react'
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
  // Only the standalone counter's menu exposes its own session history
  // (a project's lives on its "Temps" card instead) — see CLAUDE.md.
  onShowSessionHistory?: () => void
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
  onShowSessionHistory,
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
        {onShowSessionHistory && (
          <button type="button" className={styles.item} onClick={() => handle(onShowSessionHistory)}>
            <Clock size={20} strokeWidth={1.75} />
            Historique des sessions
          </button>
        )}
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
