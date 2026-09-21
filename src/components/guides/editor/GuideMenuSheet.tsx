import { useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import styles from './NodeMenuSheet.module.css'
import { ConfirmDialog, Sheet } from '../../ui'
import type { ProjectRecord } from '../../../data'

interface GuideMenuSheetProps {
  open: boolean
  onClose: () => void
  onEditMeta: () => void
  onDuplicate: () => void
  onDelete: () => void
  linkedProjects: ProjectRecord[]
}

// The guide-level "⋯" menu (renommer / lier un patron / taille are all one
// combined "Modifier" form here, see GuideMetaSheet — CLAUDE.md's "menu"
// lists actions, not necessarily one sheet each).
export function GuideMenuSheet({ open, onClose, onEditMeta, onDuplicate, onDelete, linkedProjects }: GuideMenuSheetProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  function handle(action: () => void) {
    onClose()
    action()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Guide">
        <div className={styles.list}>
          <button type="button" className={styles.item} onClick={() => handle(onEditMeta)}>
            <Pencil size={20} strokeWidth={1.75} />
            Modifier (nom, type, patron, taille)
          </button>
          <button type="button" className={styles.item} onClick={() => handle(onDuplicate)}>
            <Copy size={20} strokeWidth={1.75} />
            Dupliquer
          </button>
          <button
            type="button"
            className={styles.itemDanger}
            onClick={() => {
              onClose()
              setDeleteConfirmOpen(true)
            }}
          >
            <Trash2 size={20} strokeWidth={1.75} />
            Supprimer
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le guide"
        message={
          linkedProjects.length > 0
            ? `Ce guide est associé à : ${linkedProjects.map((project) => project.name).join(', ')}. Le supprimer retire aussi ces liens. Cette action est irréversible.`
            : 'Cette action est irréversible.'
        }
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          setDeleteConfirmOpen(false)
          onDelete()
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  )
}
