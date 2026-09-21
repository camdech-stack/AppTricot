import { Plus } from 'lucide-react'
import styles from './SectionCard.module.css'
import { BlockList } from './BlockList'
import { TreeNodeHeader } from './TreeNodeHeader'
import type { EditorController } from './editorController'
import type { Section } from '../../../data'

const METHOD_LABELS: Record<Section['method'], string> = {
  flat: 'À plat',
  round: 'En rond',
}

interface SectionCardProps {
  section: Section
  depth: number
  controller: EditorController
}

export function SectionCard({ section, depth, controller }: SectionCardProps) {
  const expanded = controller.isExpanded(section.id)

  return (
    <div className={styles.section}>
      <TreeNodeHeader
        depth={depth}
        title={section.name || 'Section sans nom'}
        subtitle={METHOD_LABELS[section.method]}
        expandable
        expanded={expanded}
        onToggleExpand={() => controller.toggleExpanded(section.id)}
        onEdit={() => controller.onEdit(section.id)}
        onOpenMenu={() => controller.onOpenMenu(section.id)}
      />

      {expanded && (
        <div>
          {section.blocks.length > 0 && <BlockList blocks={section.blocks} depth={depth + 1} controller={controller} />}
          <button type="button" className={styles.addButton} style={{ marginLeft: Math.min(depth + 1, 4) * 14 }} onClick={() => controller.onAddBlock(section.id)}>
            <Plus size={16} strokeWidth={1.75} />
            Ajouter un bloc
          </button>
        </div>
      )}
    </div>
  )
}
