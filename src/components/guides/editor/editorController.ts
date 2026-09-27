// Shared callback surface threaded through every tree-rendering component
// (PieceCard > SectionCard > BlockList/BlockCard). `onEdit`/`onOpenMenu` are
// generic (keyed by node id) since the pure guideTree functions (updateNode,
// moveNode, deleteNode, duplicateNode) already work the same way regardless
// of node kind — only creating a new node needs to know its intended parent.
// A rows block's own rows are edited in the dedicated full-screen RowsScreen
// (opened via onEdit, like any other block), which gets its own callbacks
// directly from GuideEditorPage rather than through this shared surface —
// a piece's montage/finition are the same way, owned by PieceSheet itself.
export interface EditorController {
  isExpanded: (id: string) => boolean
  toggleExpanded: (id: string) => void
  onEdit: (id: string) => void
  onOpenMenu: (id: string) => void
  onAddSection: (pieceId: string) => void
  onAddBlock: (parentId: string) => void
  reorder: (id: string, targetIndex: number) => void
}
