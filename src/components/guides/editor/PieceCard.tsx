import { Flag, Play, Plus } from 'lucide-react'
import styles from './PieceCard.module.css'
import { Card } from '../../ui'
import { SortableList } from './SortableList'
import { SectionCard } from './SectionCard'
import { TreeNodeHeader } from './TreeNodeHeader'
import { summarizeOperation } from './operationMeta'
import type { EditorController } from './editorController'
import type { Piece } from '../../../data'

interface PieceCardProps {
  piece: Piece
  controller: EditorController
}

// Montage/finition sit right under the piece's header and right after its
// sections — visible in the tree itself, not only inside the piece's own
// edit panel (retour utilisateur : elles "n'apparaissent plus" quand elles
// ne vivaient que là) — see CLAUDE.md "Décisions d'interface (étape 5a)".
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
      />

      {expanded && (
        <div className={styles.body}>
          <button type="button" className={piece.castOn ? styles.operationButton : styles.addOperationButton} onClick={() => controller.onEditOperation(piece.id, 'castOn')}>
            <span className={styles.operationIcon}>
              <Play size={16} strokeWidth={1.75} />
            </span>
            {piece.castOn ? (
              <span className={styles.operationText}>
                <span className={styles.operationLabel}>Montage</span>
                <span className={styles.operationSummary}>{summarizeOperation(piece.castOn)}</span>
              </span>
            ) : (
              'Ajouter un montage'
            )}
          </button>

          {piece.sections.length > 0 && <SectionCardList piece={piece} controller={controller} />}

          <button type="button" className={styles.addSectionButton} onClick={() => controller.onAddSection(piece.id)}>
            <Plus size={16} strokeWidth={1.75} />
            Ajouter une section
          </button>

          <button type="button" className={piece.finish ? styles.operationButton : styles.addOperationButton} onClick={() => controller.onEditOperation(piece.id, 'finish')}>
            <span className={styles.operationIcon}>
              <Flag size={16} strokeWidth={1.75} />
            </span>
            {piece.finish ? (
              <span className={styles.operationText}>
                <span className={styles.operationLabel}>Finition</span>
                <span className={styles.operationSummary}>{summarizeOperation(piece.finish)}</span>
              </span>
            ) : (
              'Ajouter une finition'
            )}
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
      className={styles.sectionList}
      renderItem={(section) => <SectionCard section={section} depth={1} controller={controller} />}
      connectorDepth={1}
    />
  )
}
