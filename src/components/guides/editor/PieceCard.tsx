import { Plus } from 'lucide-react'
import styles from './PieceCard.module.css'
import { Card } from '../../ui'
import { SortableList } from './SortableList'
import { SectionCard } from './SectionCard'
import { TreeNodeHeader } from './TreeNodeHeader'
import type { EditorController } from './editorController'
import type { Piece } from '../../../data'

interface PieceCardProps {
  piece: Piece
  controller: EditorController
}

export function PieceCard({ piece, controller }: PieceCardProps) {
  const expanded = controller.isExpanded(piece.id)

  return (
    <Card className={styles.card}>
      <TreeNodeHeader
        depth={0}
        title={piece.name || 'Pièce sans nom'}
        subtitle={`${piece.sections.length} section${piece.sections.length > 1 ? 's' : ''}`}
        expandable
        expanded={expanded}
        onToggleExpand={() => controller.toggleExpanded(piece.id)}
        onEdit={() => controller.onEdit(piece.id)}
        onOpenMenu={() => controller.onOpenMenu(piece.id)}
        accentColor="var(--color-guide-piece)"
      />

      {expanded && (
        <div className={styles.body}>
          {piece.sections.length > 0 && <SectionCardList piece={piece} controller={controller} />}

          <button type="button" className={styles.addSectionButton} onClick={() => controller.onAddSection(piece.id)}>
            <Plus size={16} strokeWidth={1.75} />
            Ajouter une section
          </button>
        </div>
      )}
    </Card>
  )
}

function SectionCardList({ piece, controller }: { piece: Piece; controller: EditorController }) {
  return (
    <SortableList
      items={piece.sections}
      onReorder={controller.reorder}
      renderItem={(section) => <SectionCard section={section} depth={1} controller={controller} />}
    />
  )
}
