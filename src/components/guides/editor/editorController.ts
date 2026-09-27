// Shared callback surface threaded through every tree-rendering component
// (PieceCard > SectionCard > BlockList/BlockCard). `onEdit`/`onOpenMenu` are
// generic (keyed by node id) since the pure guideTree functions (updateNode,
// moveNode, deleteNode, duplicateNode) already work the same way regardless
// of node kind — only creating a new node needs to know its intended parent.
// A rows block's own rows are edited in the dedicated full-screen RowsScreen
// (opened via onEdit, like any other block), which gets its own callbacks
// directly from GuideEditorPage rather than through this shared surface.
// Montage/finition are visible directly under/after a piece's sections (see
// CLAUDE.md "Décisions d'interface (étape 5a)"), not just inside the piece's
// own edit panel — `onEditOperation` opens their own full-screen sheet.
export interface EditorController {
  isExpanded: (id: string) => boolean
  toggleExpanded: (id: string) => void
  onEdit: (id: string) => void
  onOpenMenu: (id: string) => void
  onAddSection: (pieceId: string) => void
  onAddBlock: (parentId: string) => void
  onEditOperation: (pieceId: string, slot: 'castOn' | 'finish') => void
  reorder: (id: string, targetIndex: number) => void
}
