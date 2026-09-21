// Pure, immutable functions to read and edit a GuideContent tree. Every
// function here takes a GuideContent (or a raw value to validate/normalize)
// and returns a new one — nothing is ever mutated in place, which is what
// makes the editor's undo/redo history (step 5a part B) a plain array of
// past states.
import { createId } from './id'
import {
  CAST_ON_OPERATION_KINDS,
  FINISH_OPERATION_KINDS,
  MAX_BLOCK_NESTING_DEPTH,
  isContainerBlock,
  type Block,
  type BlockType,
  type ContainerBlock,
  type GuideContent,
  type GuideNode,
  type GuideNodeKind,
  type JoinMode,
  type MeasureUnit,
  type Operation,
  type OperationKind,
  type Piece,
  type Row,
  type RowSide,
  type Section,
  type SectionMethod,
} from './guideModel'

// --- Reading the tree ------------------------------------------------

export interface FoundNode {
  kind: GuideNodeKind
  node: GuideNode
}

function findInBlocks(blocks: Block[], id: string): FoundNode | undefined {
  for (const block of blocks) {
    if (block.id === id) return { kind: 'block', node: block }
    if (block.type === 'rows') {
      const row = block.rows.find((candidate) => candidate.id === id)
      if (row) return { kind: 'row', node: row }
    }
    if (isContainerBlock(block)) {
      const found = findInBlocks(block.blocks, id)
      if (found) return found
    }
  }
  return undefined
}

export function findNode(content: GuideContent, id: string): FoundNode | undefined {
  for (const piece of content.pieces) {
    if (piece.id === id) return { kind: 'piece', node: piece }
    if (piece.castOn && piece.castOn.id === id) return { kind: 'operation', node: piece.castOn }
    if (piece.finish && piece.finish.id === id) return { kind: 'operation', node: piece.finish }
    for (const section of piece.sections) {
      if (section.id === id) return { kind: 'section', node: section }
      const found = findInBlocks(section.blocks, id)
      if (found) return found
    }
  }
  return undefined
}

export interface ParentAndIndex {
  // id of the immediate parent node (piece/section/block); null for a
  // top-level piece, whose parent is the guide itself.
  parentId: string | null
  listKind: 'pieces' | 'sections' | 'blocks' | 'rows'
  index: number
  siblingCount: number
}

function findParentInBlocks(blocks: Block[], parentId: string, id: string): ParentAndIndex | undefined {
  const blockIndex = blocks.findIndex((block) => block.id === id)
  if (blockIndex !== -1) return { parentId, listKind: 'blocks', index: blockIndex, siblingCount: blocks.length }
  for (const block of blocks) {
    if (block.type === 'rows') {
      const rowIndex = block.rows.findIndex((row) => row.id === id)
      if (rowIndex !== -1) return { parentId: block.id, listKind: 'rows', index: rowIndex, siblingCount: block.rows.length }
    }
    if (isContainerBlock(block)) {
      const found = findParentInBlocks(block.blocks, block.id, id)
      if (found) return found
    }
  }
  return undefined
}

// Returns undefined for an operation (castOn/finish): it lives in a
// single-value slot on its piece, not in an orderable list.
export function getParentAndIndex(content: GuideContent, id: string): ParentAndIndex | undefined {
  const pieceIndex = content.pieces.findIndex((piece) => piece.id === id)
  if (pieceIndex !== -1) return { parentId: null, listKind: 'pieces', index: pieceIndex, siblingCount: content.pieces.length }

  for (const piece of content.pieces) {
    const sectionIndex = piece.sections.findIndex((section) => section.id === id)
    if (sectionIndex !== -1) return { parentId: piece.id, listKind: 'sections', index: sectionIndex, siblingCount: piece.sections.length }
    for (const section of piece.sections) {
      const found = findParentInBlocks(section.blocks, section.id, id)
      if (found) return found
    }
  }
  return undefined
}

function findBlockDepth(blocks: Block[], id: string, depth: number): number | undefined {
  for (const block of blocks) {
    if (block.id === id) return depth
    if (isContainerBlock(block)) {
      const found = findBlockDepth(block.blocks, id, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

// Nesting depth of a node: 0 for a section, 1 for a block directly inside
// a section, 2 for a block nested one level deeper, and so on.
export function computeNodeDepth(content: GuideContent, id: string): number | undefined {
  for (const piece of content.pieces) {
    for (const section of piece.sections) {
      if (section.id === id) return 0
      const found = findBlockDepth(section.blocks, id, 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

// Whether a block of `childType` can be added under a parent of `parentType`
// currently at `depth` (the parent's own depth, or 0 for a section) without
// exceeding MAX_BLOCK_NESTING_DEPTH. The limit applies to every block type,
// not just containers: a block sitting 5 levels deep is rejected even if
// it's a leaf, since a patron this nested is almost certainly a mistake.
export function canNest(parentType: 'section' | BlockType, _childType: BlockType, depth: number): boolean {
  const childDepth = parentType === 'section' ? 1 : depth + 1
  return childDepth <= MAX_BLOCK_NESTING_DEPTH
}

// --- Row counting and stats -------------------------------------------

export interface RowCountResult {
  knownRows: number
  hasVariableLength: boolean
}

function mergeRowCounts(a: RowCountResult, b: RowCountResult): RowCountResult {
  return { knownRows: a.knownRows + b.knownRows, hasVariableLength: a.hasVariableLength || b.hasVariableLength }
}

export function countRowsInBlocks(blocks: Block[]): RowCountResult {
  let result: RowCountResult = { knownRows: 0, hasVariableLength: false }
  for (const block of blocks) {
    if (block.type === 'rows') {
      result = mergeRowCounts(result, { knownRows: block.rows.length, hasVariableLength: false })
    } else if (block.type === 'text') {
      // No rows of its own.
    } else if (block.type === 'repeat') {
      const inner = countRowsInBlocks(block.blocks)
      result = mergeRowCounts(result, { knownRows: inner.knownRows * block.times, hasVariableLength: inner.hasVariableLength })
    } else {
      // 'measure' / 'stitch_count': the number of rows depends on gauge or
      // a live stitch count, so it's flagged rather than guessed — see
      // CLAUDE.md "Fonctions pures".
      result = mergeRowCounts(result, { knownRows: 0, hasVariableLength: true })
    }
  }
  return result
}

export function countRows(input: GuideContent | Piece | Section | Block): RowCountResult {
  if ('schemaVersion' in input) {
    return input.pieces.reduce((acc: RowCountResult, piece) => mergeRowCounts(acc, countRows(piece)), { knownRows: 0, hasVariableLength: false })
  }
  if ('sections' in input) {
    return input.sections.reduce((acc: RowCountResult, section) => mergeRowCounts(acc, countRows(section)), { knownRows: 0, hasVariableLength: false })
  }
  if ('method' in input) {
    return countRowsInBlocks(input.blocks)
  }
  return countRowsInBlocks([input])
}

export interface GuideStats {
  pieceCount: number
  sectionCount: number
  blockCount: number
  knownRows: number
  hasVariableLength: boolean
}

function countBlocksRecursive(blocks: Block[]): number {
  let count = 0
  for (const block of blocks) {
    count += 1
    if (isContainerBlock(block)) count += countBlocksRecursive(block.blocks)
  }
  return count
}

export function computeGuideStats(content: GuideContent): GuideStats {
  let sectionCount = 0
  let blockCount = 0
  let knownRows = 0
  let hasVariableLength = false

  for (const piece of content.pieces) {
    sectionCount += piece.sections.length
    for (const section of piece.sections) {
      blockCount += countBlocksRecursive(section.blocks)
      const result = countRowsInBlocks(section.blocks)
      knownRows += result.knownRows
      hasVariableLength = hasVariableLength || result.hasVariableLength
    }
  }

  return { pieceCount: content.pieces.length, sectionCount, blockCount, knownRows, hasVariableLength }
}

// --- Generic immutable tree rewriting ----------------------------------

// Finds the node with `id` anywhere in the tree and replaces it with
// `transform(node)`, or removes it when transform returns null. Powers
// updateNode, deleteNode and setOperation — every other mutation is
// expressed as a list-level edit via withSiblingList below.
function transformBlocks(blocks: Block[], id: string, transform: (node: GuideNode) => GuideNode | null): { blocks: Block[]; changed: boolean } {
  let changed = false
  const result: Block[] = []
  for (const block of blocks) {
    if (!changed && block.id === id) {
      changed = true
      const next = transform(block)
      if (next) result.push(next as Block)
      continue
    }
    if (!changed && block.type === 'rows') {
      const rowIndex = block.rows.findIndex((row) => row.id === id)
      if (rowIndex !== -1) {
        changed = true
        const target = block.rows[rowIndex]
        const next = target ? (transform(target) as Row | null) : null
        const rows = next ? block.rows.map((row, index) => (index === rowIndex ? next : row)) : block.rows.filter((_, index) => index !== rowIndex)
        result.push({ ...block, rows })
        continue
      }
    }
    if (!changed && isContainerBlock(block)) {
      const nested = transformBlocks(block.blocks, id, transform)
      if (nested.changed) {
        changed = true
        result.push({ ...block, blocks: nested.blocks } as Block)
        continue
      }
    }
    result.push(block)
  }
  return { blocks: result, changed }
}

function transformNode(content: GuideContent, id: string, transform: (node: GuideNode) => GuideNode | null): GuideContent {
  const pieceIndex = content.pieces.findIndex((piece) => piece.id === id)
  if (pieceIndex !== -1) {
    const target = content.pieces[pieceIndex]
    const next = target ? (transform(target) as Piece | null) : null
    const pieces = next
      ? content.pieces.map((piece, index) => (index === pieceIndex ? next : piece))
      : content.pieces.filter((_, index) => index !== pieceIndex)
    return { ...content, pieces }
  }

  const pieces = content.pieces.map((piece) => {
    if (piece.castOn && piece.castOn.id === id) {
      return { ...piece, castOn: transform(piece.castOn) as Operation | null }
    }
    if (piece.finish && piece.finish.id === id) {
      return { ...piece, finish: transform(piece.finish) as Operation | null }
    }
    const sectionIndex = piece.sections.findIndex((section) => section.id === id)
    if (sectionIndex !== -1) {
      const target = piece.sections[sectionIndex]
      const next = target ? (transform(target) as Section | null) : null
      const sections = next
        ? piece.sections.map((section, index) => (index === sectionIndex ? next : section))
        : piece.sections.filter((_, index) => index !== sectionIndex)
      return { ...piece, sections }
    }
    let sectionsChanged = false
    const sections = piece.sections.map((section) => {
      if (sectionsChanged) return section
      const result = transformBlocks(section.blocks, id, transform)
      if (result.changed) {
        sectionsChanged = true
        return { ...section, blocks: result.blocks }
      }
      return section
    })
    return sectionsChanged ? { ...piece, sections } : piece
  })

  return { ...content, pieces }
}

// Finds the sibling list a node with `id` directly belongs to (pieces,
// a piece's sections, a section/container's blocks, or a rows block's
// rows) and replaces that whole list with `apply(list, index)`. Powers
// moveNode and duplicateNode's insertion; deletion goes through
// transformNode instead since removing a node never needs its index.
type SiblingListApply = (list: GuideNode[], index: number) => GuideNode[]

function withSiblingListInBlocks(blocks: Block[], id: string, apply: SiblingListApply): Block[] | undefined {
  const index = blocks.findIndex((block) => block.id === id)
  if (index !== -1) return apply(blocks as GuideNode[], index) as Block[]

  let changed = false
  const next = blocks.map((block) => {
    if (changed) return block
    if (block.type === 'rows') {
      const rowIndex = block.rows.findIndex((row) => row.id === id)
      if (rowIndex !== -1) {
        changed = true
        return { ...block, rows: apply(block.rows as GuideNode[], rowIndex) as Row[] }
      }
    }
    if (isContainerBlock(block)) {
      const nested = withSiblingListInBlocks(block.blocks, id, apply)
      if (nested) {
        changed = true
        return { ...block, blocks: nested } as Block
      }
    }
    return block
  })
  return changed ? next : undefined
}

function withSiblingList(content: GuideContent, id: string, apply: SiblingListApply): GuideContent | undefined {
  const pieceIndex = content.pieces.findIndex((piece) => piece.id === id)
  if (pieceIndex !== -1) return { ...content, pieces: apply(content.pieces as GuideNode[], pieceIndex) as Piece[] }

  let changed = false
  const pieces = content.pieces.map((piece) => {
    if (changed) return piece
    const sectionIndex = piece.sections.findIndex((section) => section.id === id)
    if (sectionIndex !== -1) {
      changed = true
      return { ...piece, sections: apply(piece.sections as GuideNode[], sectionIndex) as Section[] }
    }
    let sectionsChanged = false
    const sections = piece.sections.map((section) => {
      if (sectionsChanged) return section
      const result = withSiblingListInBlocks(section.blocks, id, apply)
      if (result) {
        sectionsChanged = true
        return { ...section, blocks: result }
      }
      return section
    })
    if (sectionsChanged) changed = true
    return sectionsChanged ? { ...piece, sections } : piece
  })

  return changed ? { ...content, pieces } : undefined
}

function insertAfter(content: GuideContent, id: string, item: GuideNode): GuideContent {
  return (
    withSiblingList(content, id, (list, index) => {
      const copy = list.slice()
      copy.splice(index + 1, 0, item)
      return copy
    }) ?? content
  )
}

// --- Editing ------------------------------------------------------------

export function updateNode(content: GuideContent, id: string, patch: Record<string, unknown>): GuideContent {
  const safePatch = { ...patch }
  delete safePatch.id
  delete safePatch.type
  return transformNode(content, id, (node) => ({ ...node, ...safePatch }))
}

export function deleteNode(content: GuideContent, id: string): GuideContent {
  return transformNode(content, id, () => null)
}

export function moveNode(content: GuideContent, id: string, target: 'up' | 'down' | number): GuideContent {
  return (
    withSiblingList(content, id, (list, index) => {
      const targetIndex = target === 'up' ? index - 1 : target === 'down' ? index + 1 : Math.max(0, Math.min(target, list.length - 1))
      if (targetIndex < 0 || targetIndex >= list.length || targetIndex === index) return list
      const copy = list.slice()
      const [item] = copy.splice(index, 1)
      if (!item) return list
      copy.splice(targetIndex, 0, item)
      return copy
    }) ?? content
  )
}

function cloneRowWithNewId(row: Row): Row {
  return { ...row, id: createId() }
}

function cloneOperationWithNewId(operation: Operation): Operation {
  return { ...operation, id: createId() }
}

function cloneBlockWithNewIds(block: Block): Block {
  const id = createId()
  if (block.type === 'rows') return { ...block, id, rows: block.rows.map(cloneRowWithNewId) }
  if (block.type === 'text') return { ...block, id }
  return { ...block, id, blocks: block.blocks.map(cloneBlockWithNewIds) }
}

function cloneSectionWithNewIds(section: Section): Section {
  return { ...section, id: createId(), blocks: section.blocks.map(cloneBlockWithNewIds) }
}

function clonePieceWithNewIds(piece: Piece): Piece {
  return {
    ...piece,
    id: createId(),
    castOn: piece.castOn ? cloneOperationWithNewId(piece.castOn) : null,
    finish: piece.finish ? cloneOperationWithNewId(piece.finish) : null,
    sections: piece.sections.map(cloneSectionWithNewIds),
  }
}

// Used both by duplicateNode (a single node and its subtree) and by
// guidesRepository's whole-guide duplication.
export function cloneGuideContentWithNewIds(content: GuideContent): GuideContent {
  return { ...content, pieces: content.pieces.map(clonePieceWithNewIds) }
}

export function duplicateNode(content: GuideContent, id: string): { content: GuideContent; id: string } {
  const found = findNode(content, id)
  if (!found) return { content, id }
  if (found.kind === 'operation') throw new Error('Une opération de montage ou de finition ne peut pas être dupliquée.')

  let clone: Piece | Section | Block | Row
  if (found.kind === 'piece') clone = clonePieceWithNewIds(found.node as Piece)
  else if (found.kind === 'section') clone = cloneSectionWithNewIds(found.node as Section)
  else if (found.kind === 'block') clone = cloneBlockWithNewIds(found.node as Block)
  else clone = cloneRowWithNewId(found.node as Row)

  return { content: insertAfter(content, id, clone), id: clone.id }
}

export function addPiece(content: GuideContent, name = ''): { content: GuideContent; id: string } {
  const piece: Piece = { id: createId(), name, castOn: null, sections: [], finish: null, notes: '' }
  return { content: { ...content, pieces: [...content.pieces, piece] }, id: piece.id }
}

export interface AddSectionInput {
  name?: string
  method?: SectionMethod
}

export function addSection(content: GuideContent, pieceId: string, input: AddSectionInput = {}): { content: GuideContent; id: string } {
  const section: Section = { id: createId(), name: input.name ?? '', method: input.method ?? 'flat', blocks: [] }
  const next = transformNode(content, pieceId, (node) => {
    const piece = node as Piece
    return { ...piece, sections: [...piece.sections, section] }
  })
  return { content: next, id: section.id }
}

export interface AddBlockInput {
  text?: string
  times?: number
  length?: number
  unit?: MeasureUnit
  from?: string
  target?: number
}

function createEmptyBlock(type: BlockType, input: AddBlockInput): Block {
  const id = createId()
  switch (type) {
    case 'rows':
      return { id, type, rows: [] }
    case 'text':
      return { id, type, text: input.text ?? '' }
    case 'repeat':
      return { id, type, times: input.times ?? 1, blocks: [] }
    case 'measure':
      return { id, type, length: input.length ?? 1, unit: input.unit ?? 'cm', from: input.from ?? '', blocks: [] }
    case 'stitch_count':
      return { id, type, target: input.target ?? 0, blocks: [] }
  }
}

// Throws if adding `type` under `parentId` would exceed
// MAX_BLOCK_NESTING_DEPTH — the block-type picker sheet should filter
// offered types with canNest so this is a last-resort guard, not the
// primary UX.
export function addBlock(content: GuideContent, parentId: string, type: BlockType, input: AddBlockInput = {}): { content: GuideContent; id: string } {
  const found = findNode(content, parentId)
  const parentType: 'section' | BlockType = found?.kind === 'section' ? 'section' : (found?.node as Block)?.type
  const parentDepth = found?.kind === 'section' ? 0 : (computeNodeDepth(content, parentId) ?? 0)
  if (!canNest(parentType, type, parentDepth)) {
    throw new Error('Ce bloc dépasserait la profondeur d’imbrication maximale.')
  }

  const block = createEmptyBlock(type, input)
  const next = transformNode(content, parentId, (node) => {
    const parent = node as Section | ContainerBlock
    return { ...parent, blocks: [...parent.blocks, block] }
  })
  return { content: next, id: block.id }
}

export interface AddRowInput {
  number?: number | null
  side?: RowSide | null
  text?: string
  stitchesAfter?: number | null
}

export function addRow(content: GuideContent, blockId: string, input: AddRowInput = {}): { content: GuideContent; id: string } {
  const row: Row = {
    id: createId(),
    number: input.number ?? null,
    side: input.side ?? null,
    text: input.text ?? '',
    stitchesAfter: input.stitchesAfter ?? null,
  }
  const next = transformNode(content, blockId, (node) => {
    const block = node as Extract<Block, { type: 'rows' }>
    return { ...block, rows: [...block.rows, row] }
  })
  return { content: next, id: row.id }
}

export interface SetOperationInput {
  kind: OperationKind
  stitches?: number | null
  joinMode?: JoinMode | null
  note?: string
}

export function setOperation(content: GuideContent, pieceId: string, slot: 'castOn' | 'finish', operation: SetOperationInput | null): GuideContent {
  const allowedKinds = slot === 'castOn' ? CAST_ON_OPERATION_KINDS : FINISH_OPERATION_KINDS
  return transformNode(content, pieceId, (node) => {
    const piece = node as Piece
    if (operation === null) return { ...piece, [slot]: null }
    if (!allowedKinds.includes(operation.kind)) {
      throw new Error(`Type d'opération invalide pour ${slot === 'castOn' ? 'un montage' : 'une finition'} : ${operation.kind}`)
    }
    const existing = piece[slot]
    return {
      ...piece,
      [slot]: {
        id: existing?.id ?? createId(),
        kind: operation.kind,
        stitches: operation.stitches ?? null,
        joinMode: operation.kind === 'join' ? (operation.joinMode ?? null) : null,
        note: operation.note ?? '',
      },
    }
  })
}

// --- Pasting rows ---------------------------------------------------

export interface ParsedRow {
  number: number | null
  side: RowSide | null
  text: string
}

const ROW_NUMBER_PREFIX_PATTERNS: RegExp[] = [
  /^rang\s*(\d+)\s*[:.-]?\s*/i,
  /^rg\s*(\d+)\s*[:.-]?\s*/i,
  /^r\s*(\d+)\s*[:.-]?\s*/i,
  /^(\d+)\s*[.):]\s*/,
]

const ROW_SIDE_PATTERNS: { regex: RegExp; side: RowSide }[] = [
  { regex: /\(\s*end\s*\)/i, side: 'rs' },
  { regex: /\(\s*env\s*\)/i, side: 'ws' },
]

// One line = one row. Detects a leading number prefix ("Rang 12 :", "R12",
// "Rg 12", "12."), an "(END)"/"(ENV)" side marker anywhere in the line,
// drops empty lines, and keeps whatever text remains. A line without an
// explicit number gets the next one in sequence, continuing from
// `startingNumber`.
export function parsePastedRows(text: string, startingNumber = 1): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let nextNumber = startingNumber
  return lines.map((line) => {
    let remaining = line
    let number: number | null = null
    for (const pattern of ROW_NUMBER_PREFIX_PATTERNS) {
      const match = remaining.match(pattern)
      const captured = match?.[1]
      if (match && captured) {
        number = Number.parseInt(captured, 10)
        remaining = remaining.slice(match[0].length).trim()
        break
      }
    }

    let side: RowSide | null = null
    for (const { regex, side: candidateSide } of ROW_SIDE_PATTERNS) {
      if (regex.test(remaining)) {
        side = candidateSide
        remaining = remaining.replace(regex, '').trim()
        break
      }
    }
    // Removing a side marker that sat between the number and a separator
    // ("Rang 1 (END) : ...") can leave a stray leading ":"/"."/"-".
    remaining = remaining.replace(/^[:.-]\s*/, '').trim()

    const resolvedNumber = number ?? nextNumber
    nextNumber = resolvedNumber + 1
    return { number: resolvedNumber, side, text: remaining }
  })
}

// --- Validation and normalization ---------------------------------------

// Structural + rule errors, in French, path-prefixed so the UI (or a test)
// can point at the offending node. Never throws — always returns a list,
// empty when the content is valid.
export function validateGuideContent(input: unknown): string[] {
  const errors: string[] = []
  if (!input || typeof input !== 'object') {
    errors.push('Le contenu du guide doit être un objet.')
    return errors
  }

  const content = input as Record<string, unknown>
  if (content.schemaVersion !== 1) errors.push('Version de schéma de guide inconnue.')
  if (!Array.isArray(content.pieces)) {
    errors.push('"pieces" doit être un tableau.')
    return errors
  }

  const seenIds = new Set<string>()
  function checkId(id: unknown, path: string) {
    if (typeof id !== 'string' || id.length === 0) {
      errors.push(`${path} : identifiant manquant ou invalide.`)
      return
    }
    if (seenIds.has(id)) errors.push(`${path} : identifiant en double (${id}).`)
    seenIds.add(id)
  }

  function checkOperation(raw: unknown, path: string, allowedKinds: readonly OperationKind[]) {
    if (raw === null || raw === undefined) return
    if (typeof raw !== 'object') {
      errors.push(`${path} : opération invalide.`)
      return
    }
    const operation = raw as Record<string, unknown>
    checkId(operation.id, path)
    if (!allowedKinds.includes(operation.kind as OperationKind)) errors.push(`${path} : type d'opération invalide (${String(operation.kind)}).`)
    if (operation.stitches !== null && typeof operation.stitches !== 'number') errors.push(`${path} : nombre de mailles invalide.`)
    if (operation.kind === 'join') {
      if (operation.joinMode !== 'round' && operation.joinMode !== 'new_yarn' && operation.joinMode !== null) {
        errors.push(`${path} : mode de jonction invalide.`)
      }
    } else if (operation.joinMode !== null && operation.joinMode !== undefined) {
      errors.push(`${path} : mode de jonction renseigné hors d'une opération de jonction.`)
    }
  }

  function checkRow(raw: unknown, path: string, method: SectionMethod) {
    if (!raw || typeof raw !== 'object') {
      errors.push(`${path} : rang invalide.`)
      return
    }
    const row = raw as Record<string, unknown>
    checkId(row.id, path)
    if (row.number !== null && typeof row.number !== 'number') errors.push(`${path} : numéro de rang invalide.`)
    if (row.side !== null && row.side !== 'rs' && row.side !== 'ws') errors.push(`${path} : côté de rang invalide.`)
    if (method === 'round' && row.side !== null && row.side !== undefined) errors.push(`${path} : une section "en rond" ne doit pas avoir de rangs avec un côté.`)
    if (typeof row.text !== 'string') errors.push(`${path} : texte de rang invalide.`)
    if (row.stitchesAfter !== null && typeof row.stitchesAfter !== 'number') errors.push(`${path} : nombre de mailles après le rang invalide.`)
  }

  function checkBlocks(raw: unknown, path: string, method: SectionMethod, depth: number) {
    if (!Array.isArray(raw)) {
      errors.push(`${path} : liste de blocs invalide.`)
      return
    }
    if (depth > MAX_BLOCK_NESTING_DEPTH && raw.length > 0) errors.push(`${path} : profondeur d'imbrication maximale dépassée.`)
    raw.forEach((rawBlock, index) => {
      const blockPath = `${path}[${index}]`
      if (!rawBlock || typeof rawBlock !== 'object') {
        errors.push(`${blockPath} : bloc invalide.`)
        return
      }
      const block = rawBlock as Record<string, unknown>
      checkId(block.id, blockPath)
      switch (block.type) {
        case 'rows':
          if (!Array.isArray(block.rows)) errors.push(`${blockPath}.rows : doit être un tableau.`)
          else block.rows.forEach((row, rowIndex) => checkRow(row, `${blockPath}.rows[${rowIndex}]`, method))
          break
        case 'text':
          if (typeof block.text !== 'string') errors.push(`${blockPath}.text : doit être un texte.`)
          break
        case 'repeat':
          if (!Number.isInteger(block.times) || (block.times as number) < 1) errors.push(`${blockPath}.times : doit être un entier supérieur ou égal à 1.`)
          checkBlocks(block.blocks, `${blockPath}.blocks`, method, depth + 1)
          break
        case 'measure':
          if (typeof block.length !== 'number' || (block.length as number) <= 0) errors.push(`${blockPath}.length : doit être un nombre strictement positif.`)
          if (block.unit !== 'cm' && block.unit !== 'in') errors.push(`${blockPath}.unit : doit être "cm" ou "in".`)
          if (typeof block.from !== 'string') errors.push(`${blockPath}.from : doit être un texte.`)
          checkBlocks(block.blocks, `${blockPath}.blocks`, method, depth + 1)
          break
        case 'stitch_count':
          if (!Number.isInteger(block.target) || (block.target as number) < 0) errors.push(`${blockPath}.target : doit être un entier positif ou nul.`)
          checkBlocks(block.blocks, `${blockPath}.blocks`, method, depth + 1)
          break
        default:
          errors.push(`${blockPath} : type de bloc inconnu (${String(block.type)}).`)
      }
    })
  }

  content.pieces.forEach((rawPiece, pieceIndex) => {
    const piecePath = `pieces[${pieceIndex}]`
    if (!rawPiece || typeof rawPiece !== 'object') {
      errors.push(`${piecePath} : pièce invalide.`)
      return
    }
    const piece = rawPiece as Record<string, unknown>
    checkId(piece.id, piecePath)
    if (typeof piece.name !== 'string') errors.push(`${piecePath}.name : doit être un texte.`)
    if (typeof piece.notes !== 'string') errors.push(`${piecePath}.notes : doit être un texte.`)
    checkOperation(piece.castOn, `${piecePath}.castOn`, CAST_ON_OPERATION_KINDS)
    checkOperation(piece.finish, `${piecePath}.finish`, FINISH_OPERATION_KINDS)
    if (!Array.isArray(piece.sections)) {
      errors.push(`${piecePath}.sections : doit être un tableau.`)
      return
    }
    piece.sections.forEach((rawSection, sectionIndex) => {
      const sectionPath = `${piecePath}.sections[${sectionIndex}]`
      if (!rawSection || typeof rawSection !== 'object') {
        errors.push(`${sectionPath} : section invalide.`)
        return
      }
      const section = rawSection as Record<string, unknown>
      checkId(section.id, sectionPath)
      if (typeof section.name !== 'string') errors.push(`${sectionPath}.name : doit être un texte.`)
      if (section.method !== 'flat' && section.method !== 'round') errors.push(`${sectionPath}.method : doit être "flat" ou "round".`)
      checkBlocks(section.blocks, `${sectionPath}.blocks`, (section.method as SectionMethod) === 'round' ? 'round' : 'flat', 1)
    })
  })

  return errors
}

// Best-effort repair for whatever validateGuideContent flags as fixable:
// missing/duplicate ids get fresh ones, invalid enum values fall back to a
// safe default, out-of-range numbers get clamped, unknown block types are
// dropped, and anything nested beyond MAX_BLOCK_NESTING_DEPTH is truncated.
// Step 9 will run AI-generated content through this before it ever reaches
// the tree.
export function normalizeGuideContent(input: unknown): GuideContent {
  const seenIds = new Set<string>()
  function normalizeId(id: unknown): string {
    if (typeof id === 'string' && id.length > 0 && !seenIds.has(id)) {
      seenIds.add(id)
      return id
    }
    const fresh = createId()
    seenIds.add(fresh)
    return fresh
  }

  function normalizeOperation(raw: unknown, allowedKinds: readonly OperationKind[]): Operation | null {
    if (!raw || typeof raw !== 'object') return null
    const operation = raw as Record<string, unknown>
    const fallbackKind = allowedKinds[0] ?? 'cast_on'
    const kind = allowedKinds.includes(operation.kind as OperationKind) ? (operation.kind as OperationKind) : fallbackKind
    return {
      id: normalizeId(operation.id),
      kind,
      stitches: typeof operation.stitches === 'number' ? operation.stitches : null,
      joinMode: kind === 'join' && (operation.joinMode === 'round' || operation.joinMode === 'new_yarn') ? operation.joinMode : null,
      note: typeof operation.note === 'string' ? operation.note : '',
    }
  }

  function normalizeRow(raw: unknown, method: SectionMethod): Row {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const side = row.side === 'rs' || row.side === 'ws' ? row.side : null
    return {
      id: normalizeId(row.id),
      number: typeof row.number === 'number' ? row.number : null,
      side: method === 'round' ? null : side,
      text: typeof row.text === 'string' ? row.text : '',
      stitchesAfter: typeof row.stitchesAfter === 'number' ? row.stitchesAfter : null,
    }
  }

  function normalizeBlocks(raw: unknown, method: SectionMethod, depth: number): Block[] {
    if (!Array.isArray(raw)) return []
    const result: Block[] = []
    for (const rawBlock of raw) {
      if (!rawBlock || typeof rawBlock !== 'object') continue
      const block = rawBlock as Record<string, unknown>
      const id = normalizeId(block.id)
      const canGoDeeper = depth < MAX_BLOCK_NESTING_DEPTH
      if (block.type === 'rows') {
        const rows = Array.isArray(block.rows) ? block.rows.map((row) => normalizeRow(row, method)) : []
        result.push({ id, type: 'rows', rows })
      } else if (block.type === 'text') {
        result.push({ id, type: 'text', text: typeof block.text === 'string' ? block.text : '' })
      } else if (block.type === 'repeat') {
        result.push({
          id,
          type: 'repeat',
          times: Number.isInteger(block.times) && (block.times as number) >= 1 ? (block.times as number) : 1,
          blocks: canGoDeeper ? normalizeBlocks(block.blocks, method, depth + 1) : [],
        })
      } else if (block.type === 'measure') {
        result.push({
          id,
          type: 'measure',
          length: typeof block.length === 'number' && block.length > 0 ? block.length : 1,
          unit: block.unit === 'in' ? 'in' : 'cm',
          from: typeof block.from === 'string' ? block.from : '',
          blocks: canGoDeeper ? normalizeBlocks(block.blocks, method, depth + 1) : [],
        })
      } else if (block.type === 'stitch_count') {
        result.push({
          id,
          type: 'stitch_count',
          target: Number.isInteger(block.target) && (block.target as number) >= 0 ? (block.target as number) : 0,
          blocks: canGoDeeper ? normalizeBlocks(block.blocks, method, depth + 1) : [],
        })
      }
      // Unknown block types are dropped rather than guessed at.
    }
    return result
  }

  function normalizeSection(raw: unknown): Section {
    const section = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const method: SectionMethod = section.method === 'round' ? 'round' : 'flat'
    return {
      id: normalizeId(section.id),
      name: typeof section.name === 'string' ? section.name : '',
      method,
      blocks: normalizeBlocks(section.blocks, method, 1),
    }
  }

  function normalizePiece(raw: unknown): Piece {
    const piece = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
      id: normalizeId(piece.id),
      name: typeof piece.name === 'string' ? piece.name : '',
      castOn: normalizeOperation(piece.castOn, CAST_ON_OPERATION_KINDS),
      sections: Array.isArray(piece.sections) ? piece.sections.map(normalizeSection) : [],
      finish: normalizeOperation(piece.finish, FINISH_OPERATION_KINDS),
      notes: typeof piece.notes === 'string' ? piece.notes : '',
    }
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const pieces = Array.isArray(raw.pieces) ? raw.pieces.map(normalizePiece) : []
  return { schemaVersion: 1, pieces }
}

// Entry point for future schema versions — identity for v1. A later
// version would branch on the input's schemaVersion and translate forward.
export function migrateGuideContent(content: GuideContent): GuideContent {
  return content
}
