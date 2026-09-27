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
  // A piece/section gets a full outline in its category color ("contour
  // complet"); a block (any type, at any nesting depth) gets a tinted fill
  // instead ("fond teinté") — see CLAUDE.md "Style de blocs". `accentColor`
  // is the outline/icon color, `tintColor` the fill for the 'tint' variant.
  variant?: 'outline' | 'tint'
  accentColor?: string
  tintColor?: string
  icon?: ReactNode
  // 'start' (default): right after the chevron, before the title — see
  // CLAUDE.md "Style de blocs". 'end': after the title, right before the
  // "⋯" menu — the other of the two placements compared on user request.
  iconPosition?: 'start' | 'end'
}

// Exported so BlockList/SectionCard compute their own "Ajouter…" button
// indent with the exact same unit as the header's own margin.
export const INDENT_PX = 20
const MAX_INDENT_LEVEL = 4

// The indent is a margin on this header's own box (not padding inside it),
// so the box itself — its outline or its tint — actually narrows with
// depth instead of spanning the full row width under an indented label.
export function TreeNodeHeader({
  title,
  subtitle,
  expandable,
  expanded,
  onToggleExpand,
  onEdit,
  onOpenMenu,
  depth,
  variant = 'outline',
  accentColor,
  tintColor,
  icon,
  iconPosition = 'start',
}: TreeNodeHeaderProps) {
  const boxStyle =
    variant === 'tint'
      ? { marginLeft: Math.min(depth, MAX_INDENT_LEVEL) * INDENT_PX, background: tintColor }
      : { marginLeft: Math.min(depth, MAX_INDENT_LEVEL) * INDENT_PX, borderColor: accentColor }

  const iconEl = icon && (
    <span className={styles.icon} style={{ color: accentColor }}>
      {icon}
    </span>
  )

  return (
    <div className={variant === 'tint' ? styles.headerTint : styles.headerOutline} style={boxStyle}>
      <DragHandle color={accentColor} />
      {iconPosition === 'start' && iconEl}
      <button type="button" className={styles.main} onClick={onEdit ?? onToggleExpand}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </button>
      {iconPosition === 'end' && iconEl}
      {/* Plier/déplier à droite du bloc, juste avant le menu "⋯" — laisse
          la zone de gauche (point de glisser-déposer + icône) dégagée. */}
      {expandable ? (
        <button type="button" className={expanded ? styles.chevronExpanded : styles.chevron} aria-label={expanded ? 'Replier' : 'Déplier'} onClick={onToggleExpand}>
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      ) : (
        <span className={styles.chevronSpacer} />
      )}
      <button type="button" className={styles.menuButton} aria-label="Options" onClick={onOpenMenu}>
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>
    </div>
  )
}
