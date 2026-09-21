import styles from './BlockTypePickerSheet.module.css'
import { Sheet } from '../../ui'
import { BLOCK_TYPE_META } from './blockTypeMeta'
import type { BlockType } from '../../../data'

interface BlockTypePickerSheetProps {
  open: boolean
  onClose: () => void
  // Filters out types that would exceed the max nesting depth at the
  // target parent — see canNest in src/data/guideTree.ts.
  allowedTypes: BlockType[]
  // Only creates the block — the caller decides what happens next (most
  // types immediately open their own edit sheet, replacing this one; it
  // must NOT also be closed here, or that call would be clobbered by this
  // sheet's own onClose in the same event).
  onSelect: (type: BlockType) => void
}

export function BlockTypePickerSheet({ open, onClose, allowedTypes, onSelect }: BlockTypePickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un bloc">
      <div className={styles.list}>
        {BLOCK_TYPE_META.filter((meta) => allowedTypes.includes(meta.type)).map((meta) => (
          <button key={meta.type} type="button" className={styles.item} onClick={() => onSelect(meta.type)}>
            <span className={styles.itemLabel}>{meta.label}</span>
            <span className={styles.itemDescription}>{meta.description}</span>
            <span className={styles.itemExample}>{meta.example}</span>
          </button>
        ))}
        {allowedTypes.length === 0 && <p className={styles.empty}>Profondeur maximale atteinte : impossible d'ajouter un bloc ici.</p>}
      </div>
    </Sheet>
  )
}
