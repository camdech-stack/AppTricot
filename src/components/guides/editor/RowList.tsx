import { ClipboardPaste, MoreHorizontal, Plus } from 'lucide-react'
import styles from './RowList.module.css'
import { SortableList, DragHandle } from './SortableList'
import { Pill } from '../../ui'
import type { EditorController } from './editorController'
import type { Row } from '../../../data'

interface RowListProps {
  rows: Row[]
  blockId: string
  depth: number
  controller: EditorController
}

const INDENT_PX = 14
const MAX_INDENT_LEVEL = 4

export function RowList({ rows, blockId, depth, controller }: RowListProps) {
  const indent = Math.min(depth, MAX_INDENT_LEVEL) * INDENT_PX

  return (
    <div style={{ paddingLeft: indent }}>
      <SortableList
        items={rows}
        onReorder={controller.reorder}
        renderItem={(row) => <RowItem row={row} controller={controller} />}
      />
      <div className={styles.rowActions}>
        <button type="button" className={styles.rowAction} onClick={() => controller.onAddRow(blockId)}>
          <Plus size={16} strokeWidth={1.75} />
          Ajouter un rang
        </button>
        <button type="button" className={styles.rowAction} onClick={() => controller.onPasteRows(blockId)}>
          <ClipboardPaste size={16} strokeWidth={1.75} />
          Coller plusieurs rangs
        </button>
      </div>
    </div>
  )
}

interface RowItemProps {
  row: Row
  controller: EditorController
}

function RowItem({ row, controller }: RowItemProps) {
  return (
    <div className={styles.row}>
      <DragHandle />
      <button type="button" className={styles.rowMain} onClick={() => controller.onEdit(row.id)}>
        <span className={styles.rowNumber}>{row.number ?? '—'}</span>
        {row.side && (
          <Pill color={row.side === 'rs' ? 'primary' : 'blue'} className={styles.rowSidePill}>
            {row.side === 'rs' ? 'END' : 'ENV'}
          </Pill>
        )}
        <span className={styles.rowText}>{row.text || '(rang vide)'}</span>
        {row.stitchesAfter != null && <span className={styles.rowStitches}>{row.stitchesAfter} m</span>}
      </button>
      <button type="button" className={styles.menuButton} aria-label="Options du rang" onClick={() => controller.onOpenMenu(row.id)}>
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>
    </div>
  )
}
