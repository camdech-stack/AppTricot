// Guide format (step 5a): a typed, JSON-serializable tree describing how a
// pattern is worked — Pieces > Sections > Blocks > Rows. Plain objects,
// arrays, strings, numbers and booleans only (no classes, no Date, no Map)
// so a guide stays trivially serializable for storage, export (step 7) and
// AI generation (step 9).
//
// Every node keeps a STABLE id: editing a node's text or moving it to a
// different position/parent never changes its id — only duplicating a node
// mints new ids for it and its whole subtree. Step 5b will anchor per-node
// progress to these ids (in a separate table, never inside this tree), so
// an id must keep meaning "the same instruction" for as long as the node
// exists.

export const MAX_BLOCK_NESTING_DEPTH = 4

export type OperationKind = 'cast_on' | 'pick_up' | 'join' | 'bind_off' | 'graft' | 'three_needle_bind_off'

// A cast-on operation opens a piece; a finish operation closes it.
export const CAST_ON_OPERATION_KINDS: readonly OperationKind[] = ['cast_on', 'pick_up', 'join']
export const FINISH_OPERATION_KINDS: readonly OperationKind[] = ['bind_off', 'graft', 'three_needle_bind_off']

export type JoinMode = 'round' | 'new_yarn'

export interface Operation {
  id: string
  kind: OperationKind
  stitches: number | null
  // Only meaningful for kind === 'join'; null otherwise.
  joinMode: JoinMode | null
  note: string
}

// 'rs' = right side (endroit), 'ws' = wrong side (envers). Only meaningful
// in a 'flat' section — always null in a 'round' section, where every row
// is worked from the right side by convention.
export type RowSide = 'rs' | 'ws'

export interface Row {
  id: string
  number: number | null
  side: RowSide | null
  text: string
  stitchesAfter: number | null
}

export interface RowsBlock {
  id: string
  type: 'rows'
  rows: Row[]
}

export interface RepeatBlock {
  id: string
  type: 'repeat'
  times: number
  blocks: Block[]
}

export interface TextBlock {
  id: string
  type: 'text'
  text: string
}

export type MeasureUnit = 'cm' | 'in'

export interface MeasureBlock {
  id: string
  type: 'measure'
  length: number
  unit: MeasureUnit
  // Free short text naming the reference point, e.g. "le montage".
  from: string
  blocks: Block[]
}

export interface StitchCountBlock {
  id: string
  type: 'stitch_count'
  target: number
  blocks: Block[]
}

export type Block = RowsBlock | RepeatBlock | TextBlock | MeasureBlock | StitchCountBlock
export type ContainerBlock = RepeatBlock | MeasureBlock | StitchCountBlock
export type LeafBlock = RowsBlock | TextBlock
export type BlockType = Block['type']

export function isContainerBlock(block: Block): block is ContainerBlock {
  return block.type === 'repeat' || block.type === 'measure' || block.type === 'stitch_count'
}

export type SectionMethod = 'flat' | 'round'

export interface Section {
  id: string
  name: string
  method: SectionMethod
  blocks: Block[]
}

export interface Piece {
  id: string
  name: string
  castOn: Operation | null
  sections: Section[]
  finish: Operation | null
  notes: string
}

export interface GuideContent {
  schemaVersion: 1
  pieces: Piece[]
}

export function emptyGuideContent(): GuideContent {
  return { schemaVersion: 1, pieces: [] }
}

// Any addressable node in the tree — used by findNode/getParentAndIndex to
// return a uniform result regardless of which level matched.
export type GuideNode = Piece | Section | Block | Row | Operation
export type GuideNodeKind = 'piece' | 'section' | 'block' | 'row' | 'operation'
