// Guide progress model + pure traversal engine (step 5b). A guide (step 5a)
// is a reusable MODEL; progress through it is stored separately, per
// (project, guide) pair — never inside the guide's own content tree. See
// docs/Guidespatrons.md "Suivi et progression" for the full picture, and
// guideProgressRepository.ts for the transactional layer built on top of
// the pure functions in this file.
import { findNode } from './guideTree'
import type { Block, GuideContent, Operation, OperationKind, Piece, Row, RowSide } from './guideModel'

// --- Cursor ---------------------------------------------------------------

// A cursor pinpoints "where I am" inside a SINGLE piece's traversal, which
// always goes: the cast-on operation (if any), then each section's blocks
// in order, then the finish operation (if any). It never crosses a piece
// boundary — moving to another piece means loading/creating that other
// piece's own PieceProgress.
//
// - nodeId: the id of the leaf the cursor points to — an Operation's id
//   (cast-on/finish), a Row's id, a text block's id, or a childless
//   measure/stitch_count block's id (a "single" one-shot step) — or, for a
//   'checkpoint' cursor, the id of the measure/stitch_count block itself
//   (its "Longueur/nombre de mailles atteint ?" decision point).
// - step: which of those five kinds `nodeId` refers to.
// - blockId: for a 'row' step, the id of its containing `rows` block —
//   null for every other step (operation/text/single/checkpoint all ARE
//   their own block already). Used only by repairCursor, to land on
//   another remaining row of the SAME block when the current one was
//   deleted, rather than jumping further away than necessary.
// - passages: the current 1-based pass number of every repeat/measure/
//   stitch_count block that is an ancestor of this position (the block
//   itself included, for a 'checkpoint' cursor — the pass being
//   confirmed). ALWAYS rebuilt from scratch by every function below, from
//   the node's actual position in the (possibly just-edited) tree, so it
//   never carries a stale entry for a block that isn't an ancestor any
//   more.
export type CursorStep = 'operation' | 'row' | 'text' | 'single' | 'checkpoint'

export interface Cursor {
  nodeId: string
  step: CursorStep
  blockId: string | null
  passages: Record<string, number>
}

export type PieceStatus = 'todo' | 'in_progress' | 'done'

export const PIECE_HISTORY_LIMIT = 100

export interface PieceProgress {
  status: PieceStatus
  cursor: Cursor | null
  // Bounded to PIECE_HISTORY_LIMIT past cursors (most recent last) — how
  // `back` undoes a step without recomputing it structurally.
  history: Cursor[]
  stepsDone: number
}

export function createEmptyPieceProgress(): PieceProgress {
  return { status: 'todo', cursor: null, history: [], stepsDone: 0 }
}

// Structural shape of a guideProgress DB record that the pure functions
// below need — deliberately narrower than GuideProgressRecord (no id/
// timestamps/linkedCounterId) so they stay easy to unit test.
export interface GuideProgressState {
  activePieceId: string | null
  pieces: Record<string, PieceProgress>
}

// --- Internal: linearizing a piece into traversable units -----------------

type LeafKind = 'operation' | 'row' | 'text' | 'single'

interface LeafUnit {
  kind: LeafKind
  id: string
  sectionId: string | null // null only for a piece's own cast-on/finish
  blockId: string | null // the containing `rows` block's id, for a 'row' leaf only
}

interface ContainerUnit {
  kind: 'repeat' | 'measure' | 'stitch_count'
  id: string
  sectionId: string
  times: number | null // set for 'repeat' only
  children: Unit[]
}

type Unit = LeafUnit | ContainerUnit

function isContainerUnit(unit: Unit): unit is ContainerUnit {
  return unit.kind === 'repeat' || unit.kind === 'measure' || unit.kind === 'stitch_count'
}

// A block with no content, or a `rows` block with zero rows, produces no
// unit at all — there is nothing to step through (see CLAUDE.md "Parcours
// du guide").
function buildBlocksUnits(blocks: Block[], sectionId: string): Unit[] {
  const units: Unit[] = []
  for (const block of blocks) {
    if (block.type === 'rows') {
      for (const row of block.rows) {
        units.push({ kind: 'row', id: row.id, sectionId, blockId: block.id })
      }
    } else if (block.type === 'text') {
      units.push({ kind: 'text', id: block.id, sectionId, blockId: null })
    } else if (block.type === 'repeat') {
      const children = buildBlocksUnits(block.blocks, sectionId)
      if (children.length === 0) continue
      units.push({ kind: 'repeat', id: block.id, sectionId, times: block.times, children })
    } else {
      // measure / stitch_count
      const children = buildBlocksUnits(block.blocks, sectionId)
      if (children.length === 0) {
        units.push({ kind: 'single', id: block.id, sectionId, blockId: null })
      } else {
        units.push({ kind: block.type, id: block.id, sectionId, times: null, children })
      }
    }
  }
  return units
}

function buildPieceUnits(piece: Piece): Unit[] {
  const units: Unit[] = []
  if (piece.castOn) units.push({ kind: 'operation', id: piece.castOn.id, sectionId: null, blockId: null })
  for (const section of piece.sections) {
    units.push(...buildBlocksUnits(section.blocks, section.id))
  }
  if (piece.finish) units.push({ kind: 'operation', id: piece.finish.id, sectionId: null, blockId: null })
  return units
}

// --- Internal: locating a cursor's position in the unit tree ---------------

// A frame in the path from the piece's root unit list down to the list
// directly containing the searched-for unit. `container` is the block that
// owns `list` (null for the piece's own top-level sequence).
interface Frame {
  list: Unit[]
  index: number
  container: ContainerUnit | null
}

// Finds `id` in `units` — as a leaf item when `asCheckpoint` is false, or
// as a container's OWN id (without descending into it) when true — and
// returns the path of frames from the root down to (and including) the
// frame holding it. Recurses into every container's children regardless of
// `asCheckpoint`, since a checkpoint can sit at any nesting depth.
function locate(units: Unit[], id: string, asCheckpoint: boolean, container: ContainerUnit | null = null): Frame[] | null {
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]!
    if (asCheckpoint && isContainerUnit(unit) && unit.id === id) {
      return [{ list: units, index, container }]
    }
    if (!asCheckpoint && !isContainerUnit(unit) && unit.id === id) {
      return [{ list: units, index, container }]
    }
    if (isContainerUnit(unit)) {
      const inner = locate(unit.children, id, asCheckpoint, unit)
      if (inner) return [{ list: units, index, container }, ...inner]
    }
  }
  return null
}

// Every container that is an ancestor of `path`'s final position, keyed by
// id, with its passage number looked up in `source` (defaulting to 1) —
// the only place a Cursor's `passages` map is ever built, guaranteeing it
// never carries a stale key.
function passagesFromPath(path: Frame[], source: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const frame of path) {
    if (frame.container) result[frame.container.id] = source[frame.container.id] ?? 1
  }
  return result
}

function leafStep(leaf: LeafUnit): CursorStep {
  return leaf.kind
}

function cursorFromLeafPath(path: Frame[], leaf: LeafUnit, source: Record<string, number>): Cursor {
  return { nodeId: leaf.id, step: leafStep(leaf), blockId: leaf.blockId, passages: passagesFromPath(path, source) }
}

function cursorFromCheckpointPath(path: Frame[], container: ContainerUnit, source: Record<string, number>): Cursor {
  const passages = passagesFromPath(path, source)
  passages[container.id] = source[container.id] ?? 1
  return { nodeId: container.id, step: 'checkpoint', blockId: null, passages }
}

// Always enters `list` at its first (or, going backward, last) unit,
// descending through any nested containers, freshly assigning passage 1 to
// each one entered forward, or its already-recorded passage (from
// `source`) when entering the LAST child of a measure/stitch_count block
// backward — see back()'s documented limitation for why that can't always
// be exact.
function descendInto(
  list: Unit[],
  container: ContainerUnit | null,
  pathAbove: Frame[],
  source: Record<string, number>,
  direction: 'first' | 'last' = 'first',
): Cursor {
  const index = direction === 'first' ? 0 : list.length - 1
  const unit = list[index]!
  const frame: Frame = { list, index, container }
  const path = [...pathAbove, frame]
  if (isContainerUnit(unit)) {
    const passage = direction === 'first' ? 1 : unit.kind === 'repeat' ? (unit.times ?? 1) : (source[unit.id] ?? 1)
    const nextSource = { ...source, [unit.id]: passage }
    return descendInto(unit.children, unit, path, nextSource, direction)
  }
  return cursorFromLeafPath(path, unit, source)
}

// --- Piece traversal --------------------------------------------------------

// First step of a piece, or null if it has no step at all (see
// CLAUDE.md "Modèle de données (étape 5b)"). Only call this on a piece
// getNextAvailablePieceId currently allows starting.
export function getInitialCursor(piece: Piece): Cursor | null {
  const units = buildPieceUnits(piece)
  if (units.length === 0) return null
  return descendInto(units, null, [], {})
}

type StepResult = { kind: 'cursor'; cursor: Cursor } | { kind: 'finished' }

function toStepOrFinished(result: StepResult): Cursor | 'finished' {
  return result.kind === 'finished' ? 'finished' : result.cursor
}

// Tries to move to the unit right after `path[level]`'s current item,
// popping up through containers (auto-continuing a `repeat`'s remaining
// passes, or yielding a checkpoint when a measure/stitch_count block's
// children are exhausted) until it finds one, or falls off the piece
// entirely.
function advanceFromLevel(path: Frame[], level: number, source: Record<string, number>): StepResult {
  if (level < 0) return { kind: 'finished' }
  const frame = path[level]!
  const nextIndex = frame.index + 1
  const pathAbove = path.slice(0, level)

  if (nextIndex < frame.list.length) {
    const nextUnit = frame.list[nextIndex]!
    const fullPath = [...pathAbove, { list: frame.list, index: nextIndex, container: frame.container }]
    if (isContainerUnit(nextUnit)) {
      const nextSource = { ...source, [nextUnit.id]: 1 }
      return { kind: 'cursor', cursor: descendInto(nextUnit.children, nextUnit, fullPath, nextSource) }
    }
    return { kind: 'cursor', cursor: cursorFromLeafPath(fullPath, nextUnit, source) }
  }

  const container = frame.container
  if (!container) return { kind: 'finished' } // end of the piece's own sequence

  if (container.kind === 'repeat') {
    const times = container.times ?? 1
    const currentPass = source[container.id] ?? 1
    if (currentPass < times) {
      const nextSource = { ...source, [container.id]: currentPass + 1 }
      return { kind: 'cursor', cursor: descendInto(frame.list, container, pathAbove, nextSource) }
    }
    // Every pass of this repeat is done — it's now "consumed", same as a leaf.
    return advanceFromLevel(path, level - 1, source)
  }

  // measure / stitch_count: never auto-continues — a full pass of its
  // children always ends on a checkpoint asking whether to loop again.
  return { kind: 'cursor', cursor: cursorFromCheckpointPath(pathAbove, container, source) }
}

export interface AdvanceOptions {
  // Required when the current cursor is a checkpoint: true exits the
  // measure/stitch_count block, false starts another pass of its children.
  reached?: boolean
  // "Terminer ce bloc maintenant" — jumps past the nearest measure/
  // stitch_count ancestor of the current position right away, regardless
  // of how far through its current pass we are.
  finishBlock?: boolean
}

function resolveCheckpoint(units: Unit[], cursor: Cursor, reached: boolean): Cursor | 'finished' {
  const path = locate(units, cursor.nodeId, true)
  if (!path) return 'finished'
  const level = path.length - 1
  const frame = path[level]!
  const container = frame.list[frame.index] as ContainerUnit
  if (reached) {
    return toStepOrFinished(advanceFromLevel(path, level, cursor.passages))
  }
  const currentPass = cursor.passages[container.id] ?? 1
  const nextSource = { ...cursor.passages, [container.id]: currentPass + 1 }
  return descendInto(container.children, container, path.slice(0, level), nextSource)
}

function finishBlockFrom(units: Unit[], cursor: Cursor): Cursor | 'finished' {
  if (cursor.step === 'checkpoint') {
    const path = locate(units, cursor.nodeId, true)
    if (!path) return 'finished'
    return toStepOrFinished(advanceFromLevel(path, path.length - 1, cursor.passages))
  }
  const path = locate(units, cursor.nodeId, false)
  if (!path) return 'finished'
  for (let level = path.length - 1; level >= 0; level--) {
    const container = path[level]!.container
    if (container && (container.kind === 'measure' || container.kind === 'stitch_count')) {
      return toStepOrFinished(advanceFromLevel(path, level - 1, cursor.passages))
    }
  }
  // No measure/stitch_count ancestor to finish — the caller should only
  // offer "Terminer ce bloc" while inside one; fall back to a plain step.
  return toStepOrFinished(advanceFromLevel(path, path.length - 1, cursor.passages))
}

// The single entry point for moving forward: from `null` (piece not
// started), from a normal leaf (one step forward), from a checkpoint
// (`options.reached` required), or anywhere with `options.finishBlock`.
// Returns 'finished' once the piece's last step has been passed.
export function advance(piece: Piece, cursor: Cursor | null, options: AdvanceOptions = {}): Cursor | 'finished' {
  const units = buildPieceUnits(piece)
  if (units.length === 0) return 'finished'
  if (cursor === null) return descendInto(units, null, [], {})
  if (options.finishBlock) return finishBlockFrom(units, cursor)
  if (cursor.step === 'checkpoint') return resolveCheckpoint(units, cursor, options.reached === true)

  const path = locate(units, cursor.nodeId, false)
  if (!path) return 'finished' // the node is gone — caller should repairCursor first
  return toStepOrFinished(advanceFromLevel(path, path.length - 1, cursor.passages))
}

// --- Going back -------------------------------------------------------------

type PrevResult = Cursor | null | 'unknown'

function prevFromLevel(path: Frame[], level: number, source: Record<string, number>): PrevResult {
  if (level < 0) return null
  const frame = path[level]!
  const prevIndex = frame.index - 1
  const pathAbove = path.slice(0, level)

  if (prevIndex >= 0) {
    const prevUnit = frame.list[prevIndex]!
    if (isContainerUnit(prevUnit)) {
      if (prevUnit.kind === 'repeat') {
        const times = prevUnit.times ?? 1
        return descendInto(prevUnit.children, prevUnit, pathAbove, { ...source, [prevUnit.id]: times }, 'last')
      }
      // A measure/stitch_count block that sits entirely before us (not an
      // ancestor): we can't recover how many passes it actually took once
      // we're past it — structural `back` gives up here, per its
      // documented "sinon ne bouge pas" fallback.
      return 'unknown'
    }
    const fullPath = [...pathAbove, { list: frame.list, index: prevIndex, container: frame.container }]
    return cursorFromLeafPath(fullPath, prevUnit, source)
  }

  const container = frame.container
  if (!container) return null // the very first unit of the piece

  const pass = source[container.id] ?? 1
  if (pass > 1) {
    if (container.kind === 'repeat') {
      return descendInto(container.children, container, pathAbove, { ...source, [container.id]: pass - 1 }, 'last')
    }
    // measure / stitch_count: the immediate predecessor of its first child
    // in pass N is its own checkpoint confirming "not reached" at pass N-1.
    const passages = passagesFromPath(pathAbove, source)
    passages[container.id] = pass - 1
    return { nodeId: container.id, step: 'checkpoint', blockId: null, passages }
  }
  return prevFromLevel(path, level - 1, source)
}

function computePreviousCursor(piece: Piece, cursor: Cursor): PrevResult {
  const units = buildPieceUnits(piece)
  if (cursor.step === 'checkpoint') {
    const path = locate(units, cursor.nodeId, true)
    if (!path) return 'unknown'
    const level = path.length - 1
    const container = path[level]!.list[path[level]!.index] as ContainerUnit
    const pass = cursor.passages[container.id] ?? 1
    return descendInto(container.children, container, path.slice(0, level), { ...cursor.passages, [container.id]: pass }, 'last')
  }
  const path = locate(units, cursor.nodeId, false)
  if (!path) return 'unknown'
  return prevFromLevel(path, path.length - 1, cursor.passages)
}

// Undoes one step. Primarily pops `history` (the exact previous cursor);
// only when history is empty does it fall back to computing the previous
// step structurally — which isn't always possible (see prevFromLevel's
// "unknown" case for a fully-passed measure/stitch_count sibling), in
// which case the cursor simply doesn't move.
export function back(piece: Piece, cursor: Cursor | null, history: Cursor[] = []): Cursor | null {
  if (history.length > 0) return history[history.length - 1]!
  if (cursor === null) return null
  const result = computePreviousCursor(piece, cursor)
  return result === 'unknown' ? cursor : result
}

// --- Jumping to a specific node ---------------------------------------------

export interface GoToOptions {
  // Passage to select for the innermost repeat/measure/stitch_count block
  // directly containing the target. Defaults to the CURRENT cursor's
  // passage for that same block (jumping within the block you're already
  // in), or 1 otherwise — see CLAUDE.md "Plan du guide".
  loopPassage?: number
}

// Points the cursor at `targetNodeId` (a row, text block, operation, or
// childless measure/stitch_count block) directly, without walking through
// everything in between. Every OTHER ancestor container defaults to
// passage 1. Returns null if the target doesn't exist in this piece.
export function goTo(piece: Piece, targetNodeId: string, currentCursor: Cursor | null, options: GoToOptions = {}): Cursor | null {
  const units = buildPieceUnits(piece)
  const path = locate(units, targetNodeId, false)
  if (!path) return null
  const lastFrame = path[path.length - 1]!
  const leaf = lastFrame.list[lastFrame.index] as LeafUnit

  const passages: Record<string, number> = {}
  for (const frame of path) {
    if (frame.container) passages[frame.container.id] = 1
  }
  const innermost = [...path].reverse().find((frame) => frame.container)?.container
  if (innermost) {
    const samePassage = currentCursor?.passages[innermost.id]
    passages[innermost.id] = options.loopPassage ?? samePassage ?? 1
  }
  return { nodeId: leaf.id, step: leafStep(leaf), blockId: leaf.blockId, passages }
}

// --- Counting steps and progress --------------------------------------------

export interface StepCount {
  known: number
  hasVariableLength: boolean
}

function countUnits(units: Unit[]): StepCount {
  let known = 0
  let hasVariableLength = false
  for (const unit of units) {
    if (!isContainerUnit(unit)) {
      known += 1
      continue
    }
    const inner = countUnits(unit.children)
    if (unit.kind === 'repeat') {
      known += inner.known * (unit.times ?? 1)
      hasVariableLength = hasVariableLength || inner.hasVariableLength
    } else {
      // measure / stitch_count: only a single pass is "known" ahead of
      // time — extra passes are added to stepsDone as they happen and
      // never push a piece's percent past 100 (see getPieceProgress).
      known += inner.known
      hasVariableLength = true
    }
  }
  return { known, hasVariableLength }
}

// Total steps a piece is known to have, plus whether it also has at least
// one variable-length (measure/stitch_count) part.
export function countSteps(piece: Piece): StepCount {
  return countUnits(buildPieceUnits(piece))
}

function countFullyPassedUnit(unit: Unit): number {
  if (!isContainerUnit(unit)) return 1
  const perPass = countUnits(unit.children).known
  if (unit.kind === 'repeat') return perPass * (unit.times ?? 1)
  // A measure/stitch_count sibling we're already past: how many passes it
  // actually took isn't recoverable once we've left it (same limitation as
  // back()'s "unknown" case) — count the one known/expected pass.
  return perPass
}

function sumStepsBeforePath(list: Unit[], path: Frame[], level: number, source: Record<string, number>, isCheckpoint: boolean): number {
  const frame = path[level]!
  let sum = 0
  for (let index = 0; index < frame.index; index++) {
    sum += countFullyPassedUnit(list[index]!)
  }
  const atTarget = level === path.length - 1
  if (atTarget && isCheckpoint) {
    const container = list[frame.index] as ContainerUnit
    const pass = source[container.id] ?? 1
    sum += countUnits(container.children).known * pass
    return sum
  }
  if (atTarget) return sum // the target leaf itself hasn't been done yet

  const container = list[frame.index] as ContainerUnit
  const currentPass = source[container.id] ?? 1
  sum += countUnits(container.children).known * (currentPass - 1)
  sum += sumStepsBeforePath(container.children, path, level + 1, source, isCheckpoint)
  return sum
}

// How many leaf steps have been fully completed to reach `cursor` — used
// as PieceProgress.stepsDone after every action, recomputed from scratch
// (never accumulated) so it stays correct regardless of which action
// produced the new cursor (a plain "next", a jump, or several repeat
// passes at once). Can exceed countSteps(piece).known when a
// measure/stitch_count block took more than its one estimated pass.
export function computeStepsDone(piece: Piece, cursor: Cursor | null): number {
  if (cursor === null) return 0
  const units = buildPieceUnits(piece)
  const isCheckpoint = cursor.step === 'checkpoint'
  const path = locate(units, cursor.nodeId, isCheckpoint)
  if (!path) return 0 // caller should repairCursor first
  return sumStepsBeforePath(units, path, 0, cursor.passages, isCheckpoint)
}

export interface PieceProgressSummary {
  done: number
  total: number
  percent: number
  hasVariableLength: boolean
}

export function getPieceProgress(piece: Piece, pieceProgress: PieceProgress): PieceProgressSummary {
  const { known, hasVariableLength } = countSteps(piece)
  if (pieceProgress.status === 'done') {
    return { done: pieceProgress.stepsDone, total: known, percent: 100, hasVariableLength }
  }
  const percent = known === 0 ? 0 : Math.min(100, Math.round((pieceProgress.stepsDone / known) * 100))
  return { done: pieceProgress.stepsDone, total: known, percent, hasVariableLength }
}

export interface GuideProgressSummary {
  done: number
  total: number
  percent: number
  hasVariableLength: boolean
}

export function getGuideProgress(content: GuideContent, progress: GuideProgressState): GuideProgressSummary {
  let done = 0
  let total = 0
  let hasVariableLength = false
  for (const piece of content.pieces) {
    const pieceProgress = progress.pieces[piece.id] ?? createEmptyPieceProgress()
    const summary = getPieceProgress(piece, pieceProgress)
    done += summary.done
    total += summary.total
    hasVariableLength = hasVariableLength || summary.hasVariableLength
  }
  const percent = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100))
  return { done, total, percent, hasVariableLength }
}

// The first piece (in array order) that isn't "done" yet — pieces are
// always worked in the order they appear in `pieces`, never in parallel
// and never out of order (see CLAUDE.md "Principe"). Returns null once
// every piece is done.
export function getNextAvailablePieceId(content: GuideContent, progress: GuideProgressState): string | null {
  for (const piece of content.pieces) {
    const pieceProgress = progress.pieces[piece.id]
    if (pieceProgress?.status !== 'done') return piece.id
  }
  return null
}

// --- Describing a cursor for display ----------------------------------------

const OPERATION_LABELS: Record<OperationKind, string> = {
  cast_on: 'Monter les mailles',
  pick_up: 'Reprendre les mailles',
  join: 'Joindre',
  bind_off: 'Rabattre les mailles',
  graft: 'Greffer (Kitchener)',
  three_needle_bind_off: 'Rabattre aux 3 aiguilles',
}

function formatContainerLabel(block: Block, pass: number): string {
  if (block.type === 'repeat') return `Répétition ${pass} / ${block.times}`
  if (block.type === 'measure') return `Passage ${pass} · jusqu'à ${block.length} ${block.unit}`
  if (block.type === 'stitch_count') return `Passage ${pass} · jusqu'à ${block.target} mailles`
  return ''
}

export interface CursorDescription {
  pieceName: string
  sectionName: string | null
  blockLabel: string | null
  repeatLabel: string | null
  rowLabel: string | null
  side: RowSide | null
  stitchesAfter: number | null
  text: string
}

// Describes a cursor for the follow screen AND for step 6's "reprise
// rapide" — searches every piece for `cursor.nodeId` since a Cursor
// doesn't carry its own pieceId (node ids are UUIDs, unique in practice).
export function describeCursor(content: GuideContent, cursor: Cursor): CursorDescription | null {
  for (const piece of content.pieces) {
    const units = buildPieceUnits(piece)
    const isCheckpoint = cursor.step === 'checkpoint'
    const path = locate(units, cursor.nodeId, isCheckpoint)
    if (!path) continue

    const lastFrame = path[path.length - 1]!
    const targetUnit = lastFrame.list[lastFrame.index]!
    const section = targetUnit.sectionId ? (piece.sections.find((candidate) => candidate.id === targetUnit.sectionId) ?? null) : null

    const repeatLabel =
      path
        .map((frame) => frame.container)
        .filter((container): container is ContainerUnit => container !== null)
        .map((container) => {
          const block = findNode(content, container.id)?.node as Block | undefined
          const pass = cursor.passages[container.id] ?? 1
          return block ? formatContainerLabel(block, pass) : ''
        })
        .filter((label) => label.length > 0)
        .join(' · ') || null

    const node = findNode(content, cursor.nodeId)?.node

    let rowLabel: string | null = null
    let side: RowSide | null = null
    let stitchesAfter: number | null = null
    let blockLabel: string | null = null
    let text = ''

    if (cursor.step === 'row' && node) {
      const row = node as Row
      rowLabel = row.number != null ? `Rang ${row.number}` : 'Rang'
      side = row.side
      stitchesAfter = row.stitchesAfter
      text = row.instructions
    } else if (cursor.step === 'text' && node) {
      text = (node as Extract<Block, { type: 'text' }>).instructions
      blockLabel = 'Remarque'
    } else if (cursor.step === 'operation' && node) {
      const operation = node as Operation
      blockLabel = OPERATION_LABELS[operation.kind]
      text = operation.note
      stitchesAfter = operation.stitches
    } else if (cursor.step === 'single' && node) {
      const block = node as Extract<Block, { type: 'measure' | 'stitch_count' }>
      blockLabel = block.type === 'measure' ? `Continuer jusqu'à ${block.length} ${block.unit}` : `Continuer jusqu'à ${block.target} mailles`
    } else if (cursor.step === 'checkpoint' && node) {
      const block = node as Extract<Block, { type: 'measure' | 'stitch_count' }>
      blockLabel = block.type === 'measure' ? 'Longueur atteinte ?' : 'Nombre de mailles atteint ?'
    }

    return { pieceName: piece.name, sectionName: section?.name ?? null, blockLabel, repeatLabel, rowLabel, side, stitchesAfter, text }
  }
  return null
}

export interface ResumeSummary {
  activePieceId: string | null
  description: CursorDescription | null
  percent: number
}

// Single-guide resume summary (pure). Step 6's per-project, possibly-
// multi-guide version lives in guideProgressRepository.ts as
// getProjectResumeSummary(projectId) and wraps this one.
export function getResumeSummary(content: GuideContent, progress: GuideProgressState): ResumeSummary {
  const activePieceId = progress.activePieceId
  const pieceProgress = activePieceId ? progress.pieces[activePieceId] : undefined
  const description = pieceProgress?.cursor ? describeCursor(content, pieceProgress.cursor) : null
  return { activePieceId, description, percent: getGuideProgress(content, progress).percent }
}

// --- Repairing a cursor after the guide changed -----------------------------

export interface RepairResult {
  cursor: Cursor | null
  adjusted: boolean
}

function clampPassages(path: Frame[], cursor: Cursor): RepairResult {
  const raw = { ...cursor.passages }
  let clamped = false
  for (const frame of path) {
    if (frame.container?.kind === 'repeat') {
      const times = frame.container.times ?? 1
      const current = raw[frame.container.id] ?? 1
      if (current > times) {
        raw[frame.container.id] = times
        clamped = true
      }
    }
  }
  const pruned = passagesFromPath(path, raw)
  if (cursor.step === 'checkpoint') {
    const lastFrame = path[path.length - 1]!
    const containerId = lastFrame.list[lastFrame.index]!.id
    pruned[containerId] = raw[containerId] ?? 1
  }
  const changed = clamped || JSON.stringify(pruned) !== JSON.stringify(cursor.passages)
  return { cursor: changed ? { ...cursor, passages: pruned } : cursor, adjusted: changed }
}

function firstLeafIdOfBlock(block: Block): string | undefined {
  const units = buildBlocksUnits([block], '')
  if (units.length === 0) return undefined
  return descendInto(units, null, [], {}).nodeId
}

// Best-effort repositioning after the guide was edited underneath a
// cursor, tried in order: (1) a deleted ROW's own `rows` block still
// exists and still has at least one row left — land on its first
// remaining row (the common "fixed a typo, deleted the row" case); (2)
// the nearest still-existing ancestor repeat/measure/stitch_count
// container (from the recorded `passages`), walking outward — land on
// ITS first remaining step; (3) the very start of the piece. A `repeat`
// shortened past the recorded passage is clamped instead (see
// clampPassages) rather than treated as "deleted". There's no snapshot of
// the tree as it was before the edit, so "closest" here means "closest
// reachable from what's left", not literally the next/previous sibling.
function repairWithinPiece(piece: Piece, cursor: Cursor): RepairResult {
  const units = buildPieceUnits(piece)
  const isCheckpoint = cursor.step === 'checkpoint'
  const directPath = locate(units, cursor.nodeId, isCheckpoint)
  if (directPath) return clampPassages(directPath, cursor)

  if (cursor.blockId) {
    const found = findNode({ schemaVersion: 1, pieces: [piece] }, cursor.blockId)
    const blockNode = found?.kind === 'block' ? (found.node as Block) : undefined
    const firstLeafId = blockNode ? firstLeafIdOfBlock(blockNode) : undefined
    const path = firstLeafId ? locate(units, firstLeafId, false) : null
    if (path) {
      const lastFrame = path[path.length - 1]!
      const leaf = lastFrame.list[lastFrame.index] as LeafUnit
      const passages: Record<string, number> = {}
      for (const frame of path) if (frame.container) passages[frame.container.id] = 1
      return { cursor: { nodeId: leaf.id, step: leafStep(leaf), blockId: leaf.blockId, passages }, adjusted: true }
    }
  }

  const ancestorIds = Object.keys(cursor.passages).reverse() // innermost first
  for (const ancestorId of ancestorIds) {
    const containerPath = locate(units, ancestorId, true)
    if (!containerPath) continue
    const frame = containerPath[containerPath.length - 1]!
    const container = frame.list[frame.index] as ContainerUnit
    const source = passagesFromPath(containerPath, cursor.passages)
    return { cursor: descendInto(container.children, container, containerPath, source), adjusted: true }
  }

  if (units.length === 0) return { cursor: null, adjusted: true }
  return { cursor: descendInto(units, null, [], {}), adjusted: true }
}

// content-level wrapper: finds which piece `cursor` belongs to (by direct
// match first, then by whichever recorded ancestor still exists — node ids
// are UUIDs, so a false match across pieces is not a practical concern)
// and repairs it there. See repairWithinPiece for what "repaired" means.
export function repairCursor(content: GuideContent, cursor: Cursor): RepairResult {
  for (const piece of content.pieces) {
    const units = buildPieceUnits(piece)
    if (locate(units, cursor.nodeId, cursor.step === 'checkpoint')) {
      return repairWithinPiece(piece, cursor)
    }
  }
  if (cursor.blockId) {
    for (const piece of content.pieces) {
      if (findNode({ schemaVersion: 1, pieces: [piece] }, cursor.blockId)) {
        return repairWithinPiece(piece, cursor)
      }
    }
  }
  const ancestorIds = Object.keys(cursor.passages)
  for (const piece of content.pieces) {
    const units = buildPieceUnits(piece)
    if (ancestorIds.some((id) => locate(units, id, true))) {
      return repairWithinPiece(piece, cursor)
    }
  }
  return { cursor: null, adjusted: true }
}

// --- Node status for the guide plan sheet -----------------------------------

export interface NodeStatus {
  status: PieceStatus
  percent: number
}

// Status/percent of a piece or section node, for the "plan du guide" sheet.
// Individual rows are never marked inside a repetition (see CLAUDE.md).
export function getNodeStatus(piece: Piece, pieceProgress: PieceProgress, nodeId: string): NodeStatus {
  if (nodeId === piece.id) {
    const summary = getPieceProgress(piece, pieceProgress)
    return { status: pieceProgress.status, percent: summary.percent }
  }

  const sectionIndex = piece.sections.findIndex((candidate) => candidate.id === nodeId)
  if (sectionIndex === -1) return { status: 'todo', percent: 0 }

  if (pieceProgress.status === 'done') return { status: 'done', percent: 100 }
  if (!pieceProgress.cursor) return { status: 'todo', percent: 0 }

  const units = buildPieceUnits(piece)
  const isCheckpoint = pieceProgress.cursor.step === 'checkpoint'
  const path = locate(units, pieceProgress.cursor.nodeId, isCheckpoint)
  const cursorSectionId = path ? (path[path.length - 1]!.list[path[path.length - 1]!.index]!.sectionId ?? null) : null
  const cursorSectionIndex = cursorSectionId ? piece.sections.findIndex((candidate) => candidate.id === cursorSectionId) : -1

  const section = piece.sections[sectionIndex]!
  const sectionUnits = buildBlocksUnits(section.blocks, section.id)
  const known = countUnits(sectionUnits).known

  if (cursorSectionIndex === -1 || sectionIndex < cursorSectionIndex) {
    return { status: 'done', percent: known === 0 ? 100 : 100 }
  }
  if (sectionIndex > cursorSectionIndex) {
    return { status: 'todo', percent: 0 }
  }

  // This is the section the cursor is currently in.
  const sectionPath = locate(sectionUnits, pieceProgress.cursor.nodeId, isCheckpoint)
  const done = sectionPath ? sumStepsBeforePath(sectionUnits, sectionPath, 0, pieceProgress.cursor.passages, isCheckpoint) : 0
  const percent = known === 0 ? 0 : Math.min(100, Math.round((done / known) * 100))
  return { status: 'in_progress', percent }
}
