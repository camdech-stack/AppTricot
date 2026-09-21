import { useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from 'lucide-react'
import styles from './NodeMenuSheet.module.css'
import { ConfirmDialog, Sheet } from '../../ui'

interface NodeMenuSheetProps {
  open: boolean
  onClose: () => void
  title: string
  onEdit?: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onDelete: () => void
  // Ask for confirmation before deleting when the node has children — see
  // CLAUDE.md "menu ⋯ avec ... Supprimer (confirmation si le nœud a des
  // enfants)".
  hasChildren: boolean
}

export function NodeMenuSheet({
  open,
  onClose,
  title,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDelete,
  hasChildren,
}: NodeMenuSheetProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  function handle(action: () => void) {
    onClose()
    action()
  }

  function handleDeleteRequest() {
    if (hasChildren) {
      setDeleteConfirmOpen(true)
      return
    }
    handle(onDelete)
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        <div className={styles.list}>
          {onEdit && (
            <button type="button" className={styles.item} onClick={() => handle(onEdit)}>
              <Pencil size={20} strokeWidth={1.75} />
              Modifier
            </button>
          )}
          <button type="button" className={styles.item} onClick={() => handle(onDuplicate)}>
            <Copy size={20} strokeWidth={1.75} />
            Dupliquer
          </button>
          <button type="button" className={styles.item} disabled={!canMoveUp} onClick={() => handle(onMoveUp)}>
            <ArrowUp size={20} strokeWidth={1.75} />
            Monter
          </button>
          <button type="button" className={styles.item} disabled={!canMoveDown} onClick={() => handle(onMoveDown)}>
            <ArrowDown size={20} strokeWidth={1.75} />
            Descendre
          </button>
          <button type="button" className={styles.itemDanger} onClick={handleDeleteRequest}>
            <Trash2 size={20} strokeWidth={1.75} />
            Supprimer
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer"
        message="Ce contenu a des éléments à l'intérieur. Les supprimer aussi ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          setDeleteConfirmOpen(false)
          handle(onDelete)
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  )
}
