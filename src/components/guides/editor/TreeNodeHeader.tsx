import type { ReactNode } from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import styles from './TreeNodeHeader.module.css'
import { DragHandle } from './SortableList'

interface TreeNodeHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  expandable: boolean
  expanded: boolean
  onToggleExpand: () => void
  // Tapping the main area edits the node; when there's nothing to edit
  // (e.g. a rows block), it just toggles expansion instead.
  onEdit?: () => void
  onOpenMenu: () => void
  depth: number
}

const INDENT_PX = 14
const MAX_INDENT_LEVEL = 4

export function TreeNodeHeader({ title, subtitle, expandable, expanded, onToggleExpand, onEdit, onOpenMenu, depth }: TreeNodeHeaderProps) {
  return (
    <div className={styles.header} style={{ paddingLeft: Math.min(depth, MAX_INDENT_LEVEL) * INDENT_PX }}>
      <DragHandle />
      {expandable ? (
        <button type="button" className={expanded ? styles.chevronExpanded : styles.chevron} aria-label={expanded ? 'Replier' : 'Déplier'} onClick={onToggleExpand}>
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      ) : (
        <span className={styles.chevronSpacer} />
      )}
      <button type="button" className={styles.main} onClick={onEdit ?? onToggleExpand}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </button>
      <button type="button" className={styles.menuButton} aria-label="Options" onClick={onOpenMenu}>
        <MoreHorizontal size={20} strokeWidth={1.75} />
      </button>
    </div>
  )
}
