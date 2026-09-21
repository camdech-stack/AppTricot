// Shared callback surface threaded through every tree-rendering component
// (PieceCard > SectionCard > BlockList/BlockCard > RowList/RowItem).
// `onEdit`/`onOpenMenu` are generic (keyed by node id) since the pure
// guideTree functions (updateNode, moveNode, deleteNode, duplicateNode)
// already work the same way regardless of node kind — only creating a new
// node needs to know its intended parent.
export interface EditorController {
  isExpanded: (id: string) => boolean
  toggleExpanded: (id: string) => void
  onEdit: (id: string) => void
  onOpenMenu: (id: string) => void
  onAddOperation: (pieceId: string, slot: 'castOn' | 'finish') => void
  onAddSection: (pieceId: string) => void
  onAddBlock: (parentId: string) => void
  onAddRow: (blockId: string) => void
  onPasteRows: (blockId: string) => void
  reorder: (id: string, targetIndex: number) => void
}
