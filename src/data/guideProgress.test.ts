import { describe, expect, it } from 'vitest'
import { emptyGuideContent, type GuideContent, type Piece } from './guideModel'
import { addBlock, addPiece, addRow, addSection, setOperation } from './guideTree'
import {
  advance,
  back,
  computeStepsDone,
  countSteps,
  createEmptyPieceProgress,
  describeCursor,
  getGuideProgress,
  getInitialCursor,
  getNextAvailablePieceId,
  getNodeStatus,
  getPieceProgress,
  getResumeSummary,
  goTo,
  repairCursor,
  type Cursor,
  type GuideProgressState,
  type PieceProgress,
} from './guideProgress'

// --- Fixture builders --------------------------------------------------
// Every guide used here is invented (no real pattern content), per
// CLAUDE.md "Confidentialité" — the repo is public.

function piece(content: GuideContent, pieceId: string): Piece {
  const found = content.pieces.find((candidate) => candidate.id === pieceId)
  if (!found) throw new Error('fixture piece not found')
  return found
}

// A linear piece: cast-on (20 st) -> section "Corps" with a 2-row rows
// block -> a text block -> finish (bind-off). 5 steps total.
function buildLinearPiece() {
  let content = emptyGuideContent()
  const p = addPiece(content, 'Dos')
  content = setOperation(p.content, p.id, 'castOn', { kind: 'cast_on', stitches: 20 })
  const section = addSection(content, p.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const rowsBlock = addBlock(content, section.id, 'rows')
  content = rowsBlock.content
  const row1 = addRow(content, rowsBlock.id, { number: 1, side: 'rs', text: 'Tricoter à l’endroit', stitchesAfter: 20 })
  content = row1.content
  const row2 = addRow(content, rowsBlock.id, { number: 2, side: 'ws', text: 'Tricoter à l’envers', stitchesAfter: 20 })
  content = row2.content
  const textBlock = addBlock(content, section.id, 'text')
  content = textBlock.content
  content = setOperation(content, p.id, 'finish', { kind: 'bind_off', stitches: 20 })

  return {
    content,
    pieceId: p.id,
    sectionId: section.id,
    rowsBlockId: rowsBlock.id,
    row1Id: row1.id,
    row2Id: row2.id,
    textBlockId: textBlock.id,
  }
}

// "Répéter 10 fois: 2 rangs" -> a repeat(times: 10) containing one rows
// block of 2 rows, 20 steps total. No cast-on/finish, kept minimal.
function buildRepeatPiece(times = 10) {
  let content = emptyGuideContent()
  const p = addPiece(content, 'Écharpe')
  const section = addSection(p.content, p.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const repeatBlock = addBlock(content, section.id, 'repeat', { times })
  content = repeatBlock.content
  const rowsBlock = addBlock(content, repeatBlock.id, 'rows')
  content = rowsBlock.content
  const rowA = addRow(content, rowsBlock.id, { number: 1, text: '*2 m end, 2 m env*' })
  content = rowA.content
  const rowB = addRow(content, rowsBlock.id, { number: 2, text: 'tricoter les mailles comme elles se présentent' })
  content = rowB.content

  return { content, pieceId: p.id, sectionId: section.id, repeatBlockId: repeatBlock.id, rowsBlockId: rowsBlock.id, rowAId: rowA.id, rowBId: rowB.id }
}

// A repeat(times: 3) whose single child is ANOTHER repeat(times: 2) of a
// single row — 6 steps total, with nested passage tracking.
function buildNestedRepeatPiece() {
  let content = emptyGuideContent()
  const p = addPiece(content, 'Manche')
  const section = addSection(p.content, p.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const outer = addBlock(content, section.id, 'repeat', { times: 3 })
  content = outer.content
  const inner = addBlock(content, outer.id, 'repeat', { times: 2 })
  content = inner.content
  const rowsBlock = addBlock(content, inner.id, 'rows')
  content = rowsBlock.content
  const row = addRow(content, rowsBlock.id, { number: 1, text: 'rang' })
  content = row.content

  return { content, pieceId: p.id, outerId: outer.id, innerId: inner.id, rowsBlockId: rowsBlock.id, rowId: row.id }
}

// A measure block ("jusqu'à 14 cm") with a 1-row child block.
function buildMeasurePiece() {
  let content = emptyGuideContent()
  const p = addPiece(content, 'Dos')
  const section = addSection(p.content, p.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const measure = addBlock(content, section.id, 'measure', { length: 14, unit: 'cm', from: 'le montage' })
  content = measure.content
  const rowsBlock = addBlock(content, measure.id, 'rows')
  content = rowsBlock.content
  const row = addRow(content, rowsBlock.id, { number: 1, text: 'jersey endroit' })
  content = row.content
  const afterText = addBlock(content, section.id, 'text')
  content = afterText.content

  return { content, pieceId: p.id, measureId: measure.id, rowId: row.id, afterTextId: afterText.id }
}

// A childless measure block: "Continuer jusqu'à 14 cm" is itself a single
// one-shot step (see CLAUDE.md "Parcours du guide").
function buildChildlessMeasurePiece() {
  let content = emptyGuideContent()
  const p = addPiece(content, 'Dos')
  const section = addSection(p.content, p.id, { name: 'Corps', method: 'flat' })
  content = section.content
  const measure = addBlock(content, section.id, 'measure', { length: 14, unit: 'cm', from: 'le montage' })
  content = measure.content

  return { content, pieceId: p.id, measureId: measure.id }
}

function emptyState(): GuideProgressState {
  return { activePieceId: null, pieces: {} }
}

function withPiece(state: GuideProgressState, pieceId: string, progress: PieceProgress): GuideProgressState {
  return { ...state, pieces: { ...state.pieces, [pieceId]: progress } }
}

// --- Linear traversal ----------------------------------------------------

describe('advance — linear traversal', () => {
  it('walks cast-on, rows, text and finish in order, then finishes', () => {
    const { content, pieceId, row1Id, row2Id, textBlockId } = buildLinearPiece()
    const p = piece(content, pieceId)

    const c0 = getInitialCursor(p)
    expect(c0).toEqual({ nodeId: expect.any(String), step: 'operation', blockId: null, passages: {} })

    const c1 = advance(p, c0, {})
    expect(c1).toMatchObject({ nodeId: row1Id, step: 'row' })

    const c2 = advance(p, c1 as Cursor, {})
    expect(c2).toMatchObject({ nodeId: row2Id, step: 'row' })

    const c3 = advance(p, c2 as Cursor, {})
    expect(c3).toMatchObject({ nodeId: textBlockId, step: 'text' })

    const c4 = advance(p, c3 as Cursor, {})
    expect(c4).toMatchObject({ step: 'operation' }) // finish

    const finished = advance(p, c4 as Cursor, {})
    expect(finished).toBe('finished')
  })

  it('countSteps counts every leaf once, with no variable length', () => {
    const { content, pieceId } = buildLinearPiece()
    expect(countSteps(piece(content, pieceId))).toEqual({ known: 5, hasVariableLength: false })
  })
})

describe('empty pieces and blocks', () => {
  it('a piece with no cast-on/section/finish has no initial cursor and zero known steps', () => {
    let content = emptyGuideContent()
    const p = addPiece(content, 'Vide')
    content = p.content
    const emptyPiece = piece(content, p.id)
    expect(getInitialCursor(emptyPiece)).toBeNull()
    expect(countSteps(emptyPiece)).toEqual({ known: 0, hasVariableLength: false })
  })

  it('a rows block with zero rows and an empty repeat produce no steps', () => {
    let content = emptyGuideContent()
    const p = addPiece(content, 'Test')
    const section = addSection(p.content, p.id, { name: 'Corps', method: 'flat' })
    content = section.content
    content = addBlock(content, section.id, 'rows').content // no rows added
    content = addBlock(content, section.id, 'repeat', { times: 5 }).content // no children
    const testPiece = piece(content, p.id)
    expect(countSteps(testPiece)).toEqual({ known: 0, hasVariableLength: false })
    expect(getInitialCursor(testPiece)).toBeNull()
  })
})

// --- Repeat blocks ---------------------------------------------------------

describe('advance — repeat block', () => {
  it('"répéter 10 fois: 2 rangs" produces 20 steps with correct pass numbers', () => {
    const { content, pieceId, rowAId, rowBId } = buildRepeatPiece(10)
    const p = piece(content, pieceId)
    expect(countSteps(p)).toEqual({ known: 20, hasVariableLength: false })

    let cursor = getInitialCursor(p)
    const seen: { nodeId: string; pass: number }[] = []
    for (let i = 0; i < 20; i++) {
      if (!cursor) throw new Error('unexpected end')
      const passageId = Object.keys(cursor.passages)[0]
      seen.push({ nodeId: cursor.nodeId, pass: passageId ? cursor.passages[passageId]! : 0 })
      const next = advance(p, cursor, {})
      cursor = next === 'finished' ? null : next
    }
    expect(seen).toHaveLength(20)
    expect(seen[0]).toEqual({ nodeId: rowAId, pass: 1 })
    expect(seen[1]).toEqual({ nodeId: rowBId, pass: 1 })
    expect(seen[2]).toEqual({ nodeId: rowAId, pass: 2 })
    expect(seen[19]).toEqual({ nodeId: rowBId, pass: 10 })

    // The 20th step's cursor was consumed by the loop above (advance was
    // called on it too, landing on 'finished') — confirm that directly.
    expect(cursor).toBeNull()
  })

  it('nested repeats track each level’s own passage independently', () => {
    const { content, pieceId, outerId, innerId, rowId } = buildNestedRepeatPiece()
    const p = piece(content, pieceId)
    expect(countSteps(p)).toEqual({ known: 6, hasVariableLength: false })

    let cursor = getInitialCursor(p)
    const passages: Record<string, number>[] = []
    for (let i = 0; i < 6; i++) {
      if (!cursor) throw new Error('unexpected end')
      passages.push(cursor.passages)
      expect(cursor.nodeId).toBe(rowId)
      const next = advance(p, cursor, {})
      cursor = next === 'finished' ? null : next
    }
    expect(passages[0]).toEqual({ [outerId]: 1, [innerId]: 1 })
    expect(passages[1]).toEqual({ [outerId]: 1, [innerId]: 2 })
    expect(passages[2]).toEqual({ [outerId]: 2, [innerId]: 1 })
    expect(passages[3]).toEqual({ [outerId]: 2, [innerId]: 2 })
    expect(passages[4]).toEqual({ [outerId]: 3, [innerId]: 1 })
    expect(passages[5]).toEqual({ [outerId]: 3, [innerId]: 2 })

    // The 6th (last) step's own advance() call, made inside the loop above,
    // already returned 'finished' — confirm that's what set cursor to null.
    expect(cursor).toBeNull()
  })
})

// --- Measure / stitch_count blocks -----------------------------------------

describe('advance — measure block with children', () => {
  it('reaches the checkpoint after one pass, "Oui" continues past the block', () => {
    const { content, pieceId, measureId, rowId, afterTextId } = buildMeasurePiece()
    const p = piece(content, pieceId)

    let cursor = getInitialCursor(p) as Cursor
    expect(cursor).toMatchObject({ nodeId: rowId, step: 'row' })

    const checkpoint = advance(p, cursor, {}) as Cursor
    expect(checkpoint).toMatchObject({ nodeId: measureId, step: 'checkpoint', passages: { [measureId]: 1 } })

    const after = advance(p, checkpoint, { reached: true }) as Cursor
    expect(after).toMatchObject({ nodeId: afterTextId, step: 'text' })
  })

  it('"Pas encore" restarts a pass, then "Oui" continues', () => {
    const { content, pieceId, measureId, rowId, afterTextId } = buildMeasurePiece()
    const p = piece(content, pieceId)

    const first = getInitialCursor(p) as Cursor
    const checkpoint1 = advance(p, first, {}) as Cursor
    const secondPassStart = advance(p, checkpoint1, { reached: false }) as Cursor
    expect(secondPassStart).toMatchObject({ nodeId: rowId, step: 'row', passages: { [measureId]: 2 } })

    const checkpoint2 = advance(p, secondPassStart, {}) as Cursor
    expect(checkpoint2).toMatchObject({ nodeId: measureId, step: 'checkpoint', passages: { [measureId]: 2 } })

    const after = advance(p, checkpoint2, { reached: true }) as Cursor
    expect(after).toMatchObject({ nodeId: afterTextId })
  })

  it('"Terminer ce bloc maintenant" jumps past it mid-pass', () => {
    const { content, pieceId, rowId, afterTextId } = buildMeasurePiece()
    const p = piece(content, pieceId)
    const cursor = getInitialCursor(p) as Cursor
    expect(cursor.nodeId).toBe(rowId)

    const after = advance(p, cursor, { finishBlock: true }) as Cursor
    expect(after).toMatchObject({ nodeId: afterTextId })
  })

  it('"Terminer ce bloc maintenant" also works from the checkpoint itself', () => {
    const { content, pieceId, afterTextId } = buildMeasurePiece()
    const p = piece(content, pieceId)
    const cursor = getInitialCursor(p) as Cursor
    const checkpoint = advance(p, cursor, {}) as Cursor
    const after = advance(p, checkpoint, { finishBlock: true }) as Cursor
    expect(after).toMatchObject({ nodeId: afterTextId })
  })
})

describe('advance — childless measure/stitch_count block', () => {
  it('is a single one-shot step, not a checkpoint', () => {
    const { content, pieceId, measureId } = buildChildlessMeasurePiece()
    const p = piece(content, pieceId)
    const cursor = getInitialCursor(p) as Cursor
    expect(cursor).toEqual({ nodeId: measureId, step: 'single', blockId: null, passages: {} })
    expect(advance(p, cursor, {})).toBe('finished')
  })
})

// --- Going back -------------------------------------------------------------

describe('back', () => {
  it('pops the history stack when it is not empty', () => {
    const { content, pieceId, row1Id } = buildLinearPiece()
    const p = piece(content, pieceId)
    const c0 = getInitialCursor(p) as Cursor
    const c1 = advance(p, c0, {}) as Cursor
    expect(c1.nodeId).toBe(row1Id)
    expect(back(p, c1, [c0])).toEqual(c0)
  })

  it('does not move at the very first step when history is empty', () => {
    const { content, pieceId } = buildLinearPiece()
    const p = piece(content, pieceId)
    const c0 = getInitialCursor(p) as Cursor
    expect(back(p, c0, [])).toBeNull()
  })

  it('structurally recomputes the previous step inside a repeat, and across a passage boundary', () => {
    const { content, pieceId, repeatBlockId, rowAId, rowBId } = buildRepeatPiece(10)
    const p = piece(content, pieceId)
    const c0 = getInitialCursor(p) as Cursor // rowA, pass 1
    const c1 = advance(p, c0, {}) as Cursor // rowB, pass 1
    expect(back(p, c1, [])).toEqual(c0)

    const c2 = advance(p, c1, {}) as Cursor // rowA, pass 2 (crossed a passage boundary)
    expect(c2).toMatchObject({ nodeId: rowAId, passages: { [repeatBlockId]: 2 } })
    const back2 = back(p, c2, [])
    expect(back2).toMatchObject({ nodeId: rowBId, passages: { [repeatBlockId]: 1 } })
  })

  it('structurally recomputes the previous step right after a checkpoint', () => {
    const { content, pieceId, rowId } = buildMeasurePiece()
    const p = piece(content, pieceId)
    const c0 = getInitialCursor(p) as Cursor
    const checkpoint = advance(p, c0, {}) as Cursor
    expect(back(p, checkpoint, [])).toMatchObject({ nodeId: rowId })
  })

  it('gives up and does not move when the previous step is an already-exited measure/stitch_count sibling', () => {
    let content = emptyGuideContent()
    const p1 = addPiece(content, 'Test')
    const section = addSection(p1.content, p1.id, { name: 'Corps', method: 'flat' })
    content = section.content
    const measure = addBlock(content, section.id, 'measure', { length: 14, unit: 'cm', from: 'le montage' })
    content = measure.content
    const measureRowsBlock = addBlock(content, measure.id, 'rows')
    content = measureRowsBlock.content
    const measureRow = addRow(content, measureRowsBlock.id, { text: 'x' })
    content = measureRow.content
    const afterBlock = addBlock(content, section.id, 'text')
    content = afterBlock.content

    const testPiece = piece(content, p1.id)
    const initial = getInitialCursor(testPiece) as Cursor
    const checkpoint = advance(testPiece, initial, {}) as Cursor
    const afterMeasure = advance(testPiece, checkpoint, { reached: true }) as Cursor
    expect(afterMeasure.nodeId).toBe(afterBlock.id)

    // No history recorded: back() can't know how many passes the measure
    // block took once we're past it — it must not move.
    expect(back(testPiece, afterMeasure, [])).toEqual(afterMeasure)
  })
})

// --- goTo --------------------------------------------------------------

describe('goTo', () => {
  it('jumps directly to a row inside a repeat, defaulting to passage 1', () => {
    const { content, pieceId, repeatBlockId, rowsBlockId, rowBId } = buildRepeatPiece(10)
    const p = piece(content, pieceId)
    const cursor = goTo(p, rowBId, null)
    expect(cursor).toEqual({ nodeId: rowBId, step: 'row', blockId: rowsBlockId, passages: { [repeatBlockId]: 1 } })
  })

  it('uses the explicit loopPassage when given', () => {
    const { content, pieceId, repeatBlockId, rowsBlockId, rowAId } = buildRepeatPiece(10)
    const p = piece(content, pieceId)
    const cursor = goTo(p, rowAId, null, { loopPassage: 7 })
    expect(cursor).toEqual({ nodeId: rowAId, step: 'row', blockId: rowsBlockId, passages: { [repeatBlockId]: 7 } })
  })

  it('keeps the current passage when jumping within the same block', () => {
    const { content, pieceId, repeatBlockId, rowsBlockId, rowAId, rowBId } = buildRepeatPiece(10)
    const p = piece(content, pieceId)
    const current: Cursor = { nodeId: rowAId, step: 'row', blockId: rowsBlockId, passages: { [repeatBlockId]: 5 } }
    const cursor = goTo(p, rowBId, current)
    expect(cursor).toEqual({ nodeId: rowBId, step: 'row', blockId: rowsBlockId, passages: { [repeatBlockId]: 5 } })
  })

  it('resets to passage 1 when jumping out of the block the cursor was in', () => {
    const { content, pieceId, outerId, innerId, rowsBlockId, rowId } = buildNestedRepeatPiece()
    const p = piece(content, pieceId)
    const current: Cursor = { nodeId: rowId, step: 'row', blockId: rowsBlockId, passages: { [outerId]: 3, [innerId]: 2 } }
    // Jumping to the very same row from a different starting point still
    // treats it as "the same block" since it's the innermost ancestor.
    const cursor = goTo(p, rowId, current)
    expect(cursor).toEqual({ nodeId: rowId, step: 'row', blockId: rowsBlockId, passages: { [outerId]: 1, [innerId]: 2 } })
  })

  it('returns null for a node that does not exist in this piece', () => {
    const { content, pieceId } = buildLinearPiece()
    const p = piece(content, pieceId)
    expect(goTo(p, 'nonexistent', null)).toBeNull()
  })
})

// --- Percent / progress -----------------------------------------------------

describe('getPieceProgress / getGuideProgress', () => {
  it('caps percent at 100% even with extra measure passes', () => {
    const { content, pieceId } = buildMeasurePiece()
    const p = piece(content, pieceId)
    const c0 = getInitialCursor(p) as Cursor
    const checkpoint1 = advance(p, c0, {}) as Cursor
    const pass2 = advance(p, checkpoint1, { reached: false }) as Cursor
    const checkpoint2 = advance(p, pass2, {}) as Cursor
    const pass3 = advance(p, checkpoint2, { reached: false }) as Cursor
    const checkpoint3 = advance(p, pass3, {}) as Cursor // 3 full passes now done

    const stepsDone = computeStepsDone(p, checkpoint3)
    const pieceProgress: PieceProgress = { status: 'in_progress', cursor: checkpoint3, history: [], stepsDone }
    const summary = getPieceProgress(p, pieceProgress)
    expect(summary.total).toBe(2) // known = 1 row + 1 trailing text, first pass only
    expect(summary.done).toBeGreaterThan(summary.total)
    expect(summary.percent).toBe(100)
  })

  it('sums done/known across every piece of a guide', () => {
    let content = emptyGuideContent()
    const p1 = addPiece(content, 'Dos')
    content = p1.content
    const s1 = addSection(content, p1.id, { name: 'Corps', method: 'flat' })
    content = s1.content
    const r1block = addBlock(content, s1.id, 'rows')
    content = r1block.content
    const r1 = addRow(content, r1block.id, { text: 'a' })
    content = r1.content
    const r2 = addRow(content, r1block.id, { text: 'b' })
    content = r2.content

    const p2 = addPiece(content, 'Devant')
    content = p2.content
    const s2 = addSection(content, p2.id, { name: 'Corps', method: 'flat' })
    content = s2.content
    const r2block = addBlock(content, s2.id, 'rows')
    content = r2block.content
    const r3 = addRow(content, r2block.id, { text: 'c' })
    content = r3.content

    const piece1 = piece(content, p1.id)
    const piece2 = piece(content, p2.id)

    const progress: GuideProgressState = withPiece(
      withPiece(emptyState(), p1.id, { status: 'done', cursor: null, history: [], stepsDone: 2 }),
      p2.id,
      { status: 'todo', cursor: null, history: [], stepsDone: 0 },
    )

    const summary = getGuideProgress(content, progress)
    expect(summary.total).toBe(3) // 2 + 1
    expect(summary.done).toBe(2)
    expect(summary.percent).toBe(67)
    void piece1
    void piece2
  })
})

// --- getNextAvailablePieceId / ordering -------------------------------------

describe('getNextAvailablePieceId', () => {
  function threePieceGuide() {
    let content = emptyGuideContent()
    const p1 = addPiece(content, 'Dos')
    const p2 = addPiece(p1.content, 'Devant')
    const p3 = addPiece(p2.content, 'Manches')
    return { content: p3.content, ids: [p1.id, p2.id, p3.id] }
  }

  it('returns the first piece, then the next once the first is done, then null', () => {
    const { content, ids } = threePieceGuide()
    const [id1, id2, id3] = ids as [string, string, string]

    expect(getNextAvailablePieceId(content, emptyState())).toBe(id1)

    const afterFirst = withPiece(emptyState(), id1, { status: 'done', cursor: null, history: [], stepsDone: 0 })
    expect(getNextAvailablePieceId(content, afterFirst)).toBe(id2)

    const afterSecond = withPiece(afterFirst, id2, { status: 'done', cursor: null, history: [], stepsDone: 0 })
    expect(getNextAvailablePieceId(content, afterSecond)).toBe(id3)

    const afterThird = withPiece(afterSecond, id3, { status: 'done', cursor: null, history: [], stepsDone: 0 })
    expect(getNextAvailablePieceId(content, afterThird)).toBeNull()
  })
})

// --- repairCursor ------------------------------------------------------------

describe('repairCursor', () => {
  it('is a no-op (adjusted: false) when nothing changed', () => {
    const { content, rowsBlockId, row1Id } = buildLinearPiece()
    const cursor: Cursor = { nodeId: row1Id, step: 'row', blockId: rowsBlockId, passages: {} }
    expect(repairCursor(content, cursor)).toEqual({ cursor, adjusted: false })
  })

  it('clamps the passage when a repeat’s `times` was reduced under the recorded pass', () => {
    const { content, pieceId, repeatBlockId, rowsBlockId: repeatRowsBlockId, rowAId } = buildRepeatPiece(10)
    const cursor: Cursor = { nodeId: rowAId, step: 'row', blockId: repeatRowsBlockId, passages: { [repeatBlockId]: 8 } }

    // Simulate the editor shortening the repeat to 3 passes.
    const shortened: GuideContent = {
      ...content,
      pieces: content.pieces.map((p) =>
        p.id === pieceId
          ? {
              ...p,
              sections: p.sections.map((section) => ({
                ...section,
                blocks: section.blocks.map((block) => (block.id === repeatBlockId && block.type === 'repeat' ? { ...block, times: 3 } : block)),
              })),
            }
          : p,
      ),
    }

    const result = repairCursor(shortened, cursor)
    expect(result.adjusted).toBe(true)
    expect(result.cursor).toEqual({ nodeId: rowAId, step: 'row', blockId: repeatRowsBlockId, passages: { [repeatBlockId]: 3 } })
  })

  it('repositions to the closest remaining step when the current row was deleted', () => {
    const { content, pieceId, sectionId, rowsBlockId, row1Id, row2Id } = buildLinearPiece()
    const cursor: Cursor = { nodeId: row1Id, step: 'row', blockId: rowsBlockId, passages: {} }

    const withoutRow1: GuideContent = {
      ...content,
      pieces: content.pieces.map((p) =>
        p.id === pieceId
          ? {
              ...p,
              sections: p.sections.map((section) =>
                section.id === sectionId
                  ? {
                      ...section,
                      blocks: section.blocks.map((block) =>
                        block.id === rowsBlockId && block.type === 'rows' ? { ...block, rows: block.rows.filter((row) => row.id !== row1Id) } : block,
                      ),
                    }
                  : section,
              ),
            }
          : p,
      ),
    }

    const result = repairCursor(withoutRow1, cursor)
    expect(result.adjusted).toBe(true)
    expect(result.cursor).not.toBeNull()
    // The rows block still exists (row2 remains) — repositions inside it.
    expect(result.cursor?.nodeId).toBe(row2Id)
  })

  it('falls back to the start of the piece when the whole block containing the cursor was emptied', () => {
    const { content, pieceId, sectionId, rowsBlockId, row1Id, row2Id } = buildLinearPiece()
    const cursor: Cursor = { nodeId: row1Id, step: 'row', blockId: rowsBlockId, passages: {} }

    const emptied: GuideContent = {
      ...content,
      pieces: content.pieces.map((p) =>
        p.id === pieceId
          ? {
              ...p,
              sections: p.sections.map((section) =>
                section.id === sectionId
                  ? {
                      ...section,
                      blocks: section.blocks.map((block) =>
                        block.id === rowsBlockId && block.type === 'rows'
                          ? { ...block, rows: block.rows.filter((row) => row.id !== row1Id && row.id !== row2Id) }
                          : block,
                      ),
                    }
                  : section,
              ),
            }
          : p,
      ),
    }

    const result = repairCursor(emptied, cursor)
    expect(result.adjusted).toBe(true)
    expect(result.cursor).not.toBeNull()
    // The empty rows block disappears as a unit entirely — repositions at
    // the very start of the piece (its cast-on, in this fixture).
    const repairedPiece = piece(emptied, pieceId)
    expect(result.cursor).toEqual(getInitialCursor(repairedPiece))
  })
})

// --- describeCursor / getResumeSummary --------------------------------------

describe('describeCursor', () => {
  it('describes a row with its piece/section names, side and stitches after', () => {
    const { content, pieceId, row1Id } = buildLinearPiece()
    void pieceId
    const cursor: Cursor = { nodeId: row1Id, step: 'row', blockId: null, passages: {} }
    const description = describeCursor(content, cursor)
    expect(description).toMatchObject({
      pieceName: 'Dos',
      sectionName: 'Corps',
      rowLabel: 'Rang 1',
      side: 'rs',
      stitchesAfter: 20,
      text: 'Tricoter à l’endroit',
    })
  })

  it('describes a repeat context, including nested repeats combined with " · "', () => {
    const { content, pieceId, outerId, innerId, rowId } = buildNestedRepeatPiece()
    void pieceId
    const cursor: Cursor = { nodeId: rowId, step: 'row', blockId: null, passages: { [outerId]: 2, [innerId]: 1 } }
    const description = describeCursor(content, cursor)
    expect(description?.repeatLabel).toBe('Répétition 2 / 3 · Répétition 1 / 2')
  })

  it('describes a checkpoint', () => {
    const { content, measureId } = buildMeasurePiece()
    const cursor: Cursor = { nodeId: measureId, step: 'checkpoint', blockId: null, passages: { [measureId]: 1 } }
    const description = describeCursor(content, cursor)
    expect(description?.blockLabel).toBe('Longueur atteinte ?')
  })

  it('returns null for a cursor that matches nothing', () => {
    const { content } = buildLinearPiece()
    expect(describeCursor(content, { nodeId: 'nope', step: 'row', blockId: null, passages: {} })).toBeNull()
  })
})

describe('getResumeSummary', () => {
  it('describes the active piece’s current cursor and the guide’s percent', () => {
    const { content, pieceId, row1Id } = buildLinearPiece()
    const progress = withPiece(
      { activePieceId: pieceId, pieces: {} },
      pieceId,
      { status: 'in_progress', cursor: { nodeId: row1Id, step: 'row', blockId: null, passages: {} }, history: [], stepsDone: 1 },
    )
    const summary = getResumeSummary(content, progress)
    expect(summary.activePieceId).toBe(pieceId)
    expect(summary.description?.rowLabel).toBe('Rang 1')
    expect(summary.percent).toBe(20) // 1 of 5 known steps (cast-on, 2 rows, text, finish)
  })
})

// --- getNodeStatus -----------------------------------------------------------

describe('getNodeStatus', () => {
  it('marks the piece and its current section as in_progress, later sections as todo', () => {
    let content = emptyGuideContent()
    const p = addPiece(content, 'Dos')
    content = p.content
    const s1 = addSection(content, p.id, { name: 'Côtes', method: 'flat' })
    content = s1.content
    const s1rows = addBlock(content, s1.id, 'rows')
    content = s1rows.content
    const s1row = addRow(content, s1rows.id, { text: 'a' })
    content = s1row.content
    const s2 = addSection(content, p.id, { name: 'Corps', method: 'flat' })
    content = s2.content
    const s2rows = addBlock(content, s2.id, 'rows')
    content = s2rows.content
    const s2row = addRow(content, s2rows.id, { text: 'b' })
    content = s2row.content

    const testPiece = piece(content, p.id)
    const cursor: Cursor = { nodeId: s1row.id, step: 'row', blockId: null, passages: {} }
    const pieceProgress: PieceProgress = { status: 'in_progress', cursor, history: [], stepsDone: 0 }

    expect(getNodeStatus(testPiece, pieceProgress, s1.id).status).toBe('in_progress')
    expect(getNodeStatus(testPiece, pieceProgress, s2.id)).toEqual({ status: 'todo', percent: 0 })
  })

  it('marks everything done once the piece is done', () => {
    const { content, pieceId, sectionId } = buildLinearPiece()
    const testPiece = piece(content, pieceId)
    const done: PieceProgress = { status: 'done', cursor: null, history: [], stepsDone: 4 }
    expect(getNodeStatus(testPiece, done, pieceId)).toEqual({ status: 'done', percent: 100 })
    expect(getNodeStatus(testPiece, done, sectionId)).toEqual({ status: 'done', percent: 100 })
  })
})

describe('createEmptyPieceProgress', () => {
  it('starts todo, with a null cursor and no history', () => {
    expect(createEmptyPieceProgress()).toEqual({ status: 'todo', cursor: null, history: [], stepsDone: 0 })
  })
})
