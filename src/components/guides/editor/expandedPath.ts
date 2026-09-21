// Pure helper for the editor's initial pliage: which piece/section/block
// ids must start expanded so `targetId` (the guide's lastEditedNodeId) is
// visible without the user unfolding anything by hand.
import { isContainerBlock, type Block, type GuideContent } from '../../../data'

function collectBlockAncestors(blocks: Block[], targetId: string, trail: string[]): string[] | null {
  for (const block of blocks) {
    if (block.id === targetId) return trail
    if (block.type === 'rows' && block.rows.some((row) => row.id === targetId)) return [...trail, block.id]
    if (isContainerBlock(block)) {
      const found = collectBlockAncestors(block.blocks, targetId, [...trail, block.id])
      if (found) return found
    }
  }
  return null
}

export function computeAncestorIds(content: GuideContent, targetId: string | null): string[] {
  if (!targetId) return []
  for (const piece of content.pieces) {
    if (piece.id === targetId) return []
    if ((piece.castOn && piece.castOn.id === targetId) || (piece.finish && piece.finish.id === targetId)) return [piece.id]
    for (const section of piece.sections) {
      if (section.id === targetId) return [piece.id]
      const found = collectBlockAncestors(section.blocks, targetId, [piece.id, section.id])
      if (found) return found
    }
  }
  return []
}
