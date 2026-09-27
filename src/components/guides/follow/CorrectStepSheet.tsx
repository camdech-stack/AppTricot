import { RowsScreen } from '../editor/RowsScreen'
import { OperationSheet, TextBlockSheet, MeasureSheet, StitchCountSheet } from '../editor/NodeFormSheets'
import {
  deleteNode,
  duplicateNode,
  findNode,
  moveNode,
  setOperation,
  updateNode,
  type Block,
  type Cursor,
  type GuideContent,
  type Operation,
  type Piece,
} from '../../../data'

interface CorrectStepSheetProps {
  open: boolean
  onClose: () => void
  content: GuideContent
  cursor: Cursor
  onContentChanged: (next: GuideContent) => void
}

function findOwningPieceAndSlot(content: GuideContent, operationId: string): { piece: Piece; slot: 'castOn' | 'finish' } | undefined {
  for (const piece of content.pieces) {
    if (piece.castOn?.id === operationId) return { piece, slot: 'castOn' }
    if (piece.finish?.id === operationId) return { piece, slot: 'finish' }
  }
  return undefined
}

function findSectionMethod(content: GuideContent, blockId: string): 'flat' | 'round' {
  for (const piece of content.pieces) {
    for (const section of piece.sections) {
      if (section.blocks.some((block) => block.id === blockId)) return section.method
    }
  }
  return 'flat'
}

// Opens the exact same editor sheet the guide editor itself uses for the
// current step's node — a typo fix or a deletion here goes through
// updateNode/deleteNode like any other edit, then the caller (the follow
// screen) runs repairActiveCursor and shows an "ajusté" message if needed.
export function CorrectStepSheet({ open, onClose, content, cursor, onContentChanged }: CorrectStepSheetProps) {
  if (!open) return null

  if (cursor.step === 'row' && cursor.blockId) {
    const found = findNode(content, cursor.blockId)
    const block = found?.kind === 'block' ? (found.node as Extract<Block, { type: 'rows' }>) : undefined
    if (!block) return null
    const showSide = findSectionMethod(content, cursor.blockId) === 'flat'
    return (
      <RowsScreen
        open
        onClose={onClose}
        rows={block.rows}
        showSide={showSide}
        onReorder={(id, targetIndex) => onContentChanged(moveNode(content, id, targetIndex))}
        onChangeRow={(id, patch) => onContentChanged(updateNode(content, id, { ...patch }))}
        onDuplicateRow={(id) => onContentChanged(duplicateNode(content, id).content)}
        onDeleteRow={(id) => onContentChanged(deleteNode(content, id))}
        onAddRow={() => {
          // Corriger n'ajoute pas de nouveau rang — seulement modifier/
          // supprimer ceux déjà écrits (voir CLAUDE.md "Corriger").
        }}
        onPasteRows={() => {}}
      />
    )
  }

  if (cursor.step === 'text') {
    const found = findNode(content, cursor.nodeId)
    const block = found?.kind === 'block' ? (found.node as Extract<Block, { type: 'text' }>) : undefined
    if (!block) return null
    return (
      <TextBlockSheet
        open
        onClose={onClose}
        initialText={block.instructions}
        onSave={(text) => onContentChanged(updateNode(content, cursor.nodeId, { instructions: text }))}
      />
    )
  }

  if (cursor.step === 'operation') {
    const owner = findOwningPieceAndSlot(content, cursor.nodeId)
    if (!owner) return null
    const initial: Operation | null = owner.slot === 'castOn' ? owner.piece.castOn : owner.piece.finish
    return (
      <OperationSheet
        open
        onClose={onClose}
        slot={owner.slot}
        initial={initial}
        onSave={(input) => onContentChanged(setOperation(content, owner.piece.id, owner.slot, input))}
      />
    )
  }

  if (cursor.step === 'single' || cursor.step === 'checkpoint') {
    const found = findNode(content, cursor.nodeId)
    const block = found?.kind === 'block' ? (found.node as Block) : undefined
    if (!block) return null
    if (block.type === 'measure') {
      return (
        <MeasureSheet
          open
          onClose={onClose}
          initialLength={block.length}
          initialUnit={block.unit}
          initialFrom={block.from}
          initialInstructions={block.instructions}
          onSave={(input) => onContentChanged(updateNode(content, cursor.nodeId, input))}
        />
      )
    }
    if (block.type === 'stitch_count') {
      return (
        <StitchCountSheet
          open
          onClose={onClose}
          initialTarget={block.target}
          initialInstructions={block.instructions}
          onSave={(input) => onContentChanged(updateNode(content, cursor.nodeId, input))}
        />
      )
    }
  }

  return null
}
