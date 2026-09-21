import { Plus } from 'lucide-react'
import styles from './BlockList.module.css'
import { SortableList } from './SortableList'
import { RowList } from './RowList'
import { TreeNodeHeader } from './TreeNodeHeader'
import { blockTypeLabel, summarizeMeasureBlock, summarizeRepeatBlock, summarizeStitchCountBlock } from './blockTypeMeta'
import { countRowsInBlocks, isContainerBlock, type Block } from '../../../data'
import type { EditorController } from './editorController'

interface BlockListProps {
  blocks: Block[]
  depth: number
  controller: EditorController
}

export function BlockList({ blocks, depth, controller }: BlockListProps) {
  return (
    <SortableList
      items={blocks}
      onReorder={controller.reorder}
      renderItem={(block) => <BlockCard block={block} depth={depth} controller={controller} />}
    />
  )
}

interface BlockCardProps {
  block: Block
  depth: number
  controller: EditorController
}

function blockSubtitle(block: Block): string | undefined {
  switch (block.type) {
    case 'repeat':
      return summarizeRepeatBlock(block)
    case 'measure':
      return summarizeMeasureBlock(block)
    case 'stitch_count':
      return summarizeStitchCountBlock(block)
    case 'rows': {
      const count = countRowsInBlocks([block]).knownRows
      return `${count} rang${count > 1 ? 's' : ''}`
    }
    case 'text':
      return block.text || undefined
  }
}

function BlockCard({ block, depth, controller }: BlockCardProps) {
  const expanded = controller.isExpanded(block.id)
  const expandable = block.type !== 'text'
  const editable = block.type !== 'rows'

  return (
    <div className={styles.block}>
      <TreeNodeHeader
        depth={depth}
        title={blockTypeLabel(block.type)}
        subtitle={blockSubtitle(block)}
        expandable={expandable}
        expanded={expanded}
        onToggleExpand={() => controller.toggleExpanded(block.id)}
        onEdit={editable ? () => controller.onEdit(block.id) : undefined}
        onOpenMenu={() => controller.onOpenMenu(block.id)}
      />

      {expanded && block.type === 'rows' && <RowList rows={block.rows} blockId={block.id} depth={depth + 1} controller={controller} />}

      {expanded && isContainerBlock(block) && (
        <div>
          {block.blocks.length > 0 && <BlockList blocks={block.blocks} depth={depth + 1} controller={controller} />}
          <button
            type="button"
            className={styles.addBlockButton}
            style={{ marginLeft: Math.min(depth + 1, 4) * 14 }}
            onClick={() => controller.onAddBlock(block.id)}
          >
            <Plus size={16} strokeWidth={1.75} />
            Ajouter un bloc
          </button>
        </div>
      )}
    </div>
  )
}
