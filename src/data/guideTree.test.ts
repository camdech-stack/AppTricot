import { describe, expect, it } from 'vitest'
import { emptyGuideContent, MAX_BLOCK_NESTING_DEPTH, type GuideContent } from './guideModel'
import {
  addBlock,
  addPiece,
  addRow,
  addSection,
  canNest,
  computeGuideStats,
  computeNodeDepth,
  countRows,
  deleteNode,
  duplicateNode,
  findNode,
  getParentAndIndex,
  moveNode,
  normalizeGuideContent,
  parsePastedRows,
  setOperation,
  updateNode,
  validateGuideContent,
} from './guideTree'

function withPieceAndSection(content: GuideContent = emptyGuideContent()) {
  const afterPiece = addPiece(content, 'Dos')
  const afterSection = addSection(afterPiece.content, afterPiece.id, { name: 'Corps', method: 'flat' })
  return { content: afterSection.content, pieceId: afterPiece.id, sectionId: afterSection.id }
}

describe('addPiece/addSection/addBlock/addRow', () => {
  it('builds a tree and keeps ids stable across the chain', () => {
    const { content, pieceId, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'rows')
    const { content: withRow, id: rowId } = addRow(withBlock, blockId, { number: 1, text: '1 m end, 1 m env' })

    const piece = findNode(withRow, pieceId)
    const section = findNode(withRow, sectionId)
    const row = findNode(withRow, rowId)
    expect(piece?.kind).toBe('piece')
    expect(section?.kind).toBe('section')
    expect(row).toEqual({ kind: 'row', node: { id: rowId, number: 1, side: null, text: '1 m end, 1 m env', stitchesAfter: null } })
  })

  it('"repeat rows 1 and 2, 10 times" counts as 20 known rows', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withRepeat, id: repeatId } = addBlock(content, sectionId, 'repeat', { times: 10 })
    const { content: withRows, id: rowsBlockId } = addBlock(withRepeat, repeatId, 'rows')
    const { content: withRow1 } = addRow(withRows, rowsBlockId, { number: 1 })
    const { content: final } = addRow(withRow1, rowsBlockId, { number: 2 })

    expect(countRows(final).knownRows).toBe(20)
    expect(countRows(final).hasVariableLength).toBe(false)
    expect(computeGuideStats(final).knownRows).toBe(20)
  })

  it('nests a repeat inside a repeat', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withOuter, id: outerId } = addBlock(content, sectionId, 'repeat', { times: 2 })
    const { content: withInner, id: innerId } = addBlock(withOuter, outerId, 'repeat', { times: 3 })
    const { content: withRows, id: rowsId } = addBlock(withInner, innerId, 'rows')
    const { content: final } = addRow(withRows, rowsId, { number: 1 })

    expect(countRows(final).knownRows).toBe(6)
  })

  it('flags measure and stitch_count blocks as variable length instead of estimating', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withMeasure } = addBlock(content, sectionId, 'measure', { length: 14, unit: 'cm', from: 'le montage' })
    expect(countRows(withMeasure).hasVariableLength).toBe(true)
    expect(countRows(withMeasure).knownRows).toBe(0)

    const { content: withStitchCount } = addBlock(content, sectionId, 'stitch_count', { target: 45 })
    expect(countRows(withStitchCount).hasVariableLength).toBe(true)
  })

  it('rejects nesting beyond the max depth', () => {
    const { content, sectionId } = withPieceAndSection()
    let parentId = sectionId
    let current = content
    for (let level = 1; level <= MAX_BLOCK_NESTING_DEPTH; level += 1) {
      const result = addBlock(current, parentId, 'repeat', { times: 1 })
      current = result.content
      parentId = result.id
    }
    expect(() => addBlock(current, parentId, 'repeat', { times: 1 })).toThrow()
  })
})

describe('canNest', () => {
  it('allows a container at depth 3 to gain a child (depth 4)', () => {
    expect(canNest('repeat', 'repeat', 3)).toBe(true)
  })

  it('rejects a container at depth 4 gaining a child (depth 5)', () => {
    expect(canNest('repeat', 'repeat', 4)).toBe(false)
  })

  it('always allows a first-level child of a section', () => {
    expect(canNest('section', 'rows', 0)).toBe(true)
  })
})

describe('updateNode', () => {
  it('changes fields without changing the id', () => {
    const { content, pieceId } = withPieceAndSection()
    const updated = updateNode(content, pieceId, { name: 'Devant' })
    const found = findNode(updated, pieceId)
    expect(found?.node).toMatchObject({ id: pieceId, name: 'Devant' })
  })

  it('keeps a row id stable when its text is edited', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'rows')
    const { content: withRow, id: rowId } = addRow(withBlock, blockId, { text: 'avant' })
    const updated = updateNode(withRow, rowId, { text: 'après' })
    expect(findNode(updated, rowId)?.node).toMatchObject({ id: rowId, text: 'après' })
  })

  it('ignores an attempt to change the id or type', () => {
    const { content, sectionId } = withPieceAndSection()
    const updated = updateNode(content, sectionId, { id: 'hacked', type: 'nope', name: 'Manche' })
    expect(findNode(updated, sectionId)?.node).toMatchObject({ id: sectionId, name: 'Manche' })
    expect(findNode(updated, 'hacked')).toBeUndefined()
  })
})

describe('moveNode', () => {
  it('keeps ids stable when moving a section up within its parent list', () => {
    const { content, pieceId, sectionId: firstSectionId } = withPieceAndSection()
    const { content: withSection2, id: section2Id } = addSection(content, pieceId, { name: 'Bordure' })
    const moved = moveNode(withSection2, section2Id, 'up')
    const sections = (findNode(moved, pieceId)!.node as { sections: { id: string }[] }).sections
    expect(sections.map((section) => section.id)).toEqual([section2Id, firstSectionId])
  })

  it('is a no-op moving the first item up or the last item down', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'text', { text: 'a' })
    const attemptUp = moveNode(withBlock, blockId, 'up')
    expect(attemptUp).toEqual(withBlock)
    const attemptDown = moveNode(withBlock, blockId, 'down')
    expect(attemptDown).toEqual(withBlock)
  })

  it('reorders rows within the same rows block only', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'rows')
    const { content: r1, id: row1 } = addRow(withBlock, blockId, { number: 1 })
    const { content: r2, id: row2 } = addRow(r1, blockId, { number: 2 })
    const moved = moveNode(r2, row2, 'up')
    const block = findNode(moved, blockId)?.node as { rows: { id: string }[] }
    expect(block.rows.map((row) => row.id)).toEqual([row2, row1])
  })
})

describe('duplicateNode', () => {
  it('assigns new ids to the duplicated node and its whole subtree', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withRepeat, id: repeatId } = addBlock(content, sectionId, 'repeat', { times: 2 })
    const { content: withRows, id: rowsId } = addBlock(withRepeat, repeatId, 'rows')
    const { content: withRow, id: rowId } = addRow(withRows, rowsId, { number: 1 })

    const { content: duplicated, id: newRepeatId } = duplicateNode(withRow, repeatId)
    expect(newRepeatId).not.toBe(repeatId)

    const original = findNode(duplicated, repeatId)
    const clone = findNode(duplicated, newRepeatId)
    expect(original).toBeDefined()
    expect(clone).toBeDefined()

    const cloneRepeat = clone!.node as { blocks: { id: string; type: string; rows?: { id: string }[] }[] }
    expect(cloneRepeat.blocks[0]!.id).not.toBe(rowsId)
    expect(cloneRepeat.blocks[0]!.rows?.[0]!.id).not.toBe(rowId)

    // The duplicate sits right after the original in the same parent list.
    const section = findNode(duplicated, sectionId)?.node as { blocks: { id: string }[] }
    expect(section.blocks.map((block) => block.id)).toEqual([repeatId, newRepeatId])
  })
})

describe('deleteNode', () => {
  it('removes a node and everything under it', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'text', { text: 'note' })
    const deleted = deleteNode(withBlock, blockId)
    expect(findNode(deleted, blockId)).toBeUndefined()
  })

  it('clears an operation slot back to null', () => {
    const { content, pieceId } = withPieceAndSection()
    const withCastOn = setOperation(content, pieceId, 'castOn', { kind: 'cast_on', stitches: 80 })
    const castOn = findNode(withCastOn, pieceId)?.node as { castOn: { id: string } | null }
    const deleted = deleteNode(withCastOn, castOn.castOn!.id)
    const piece = findNode(deleted, pieceId)?.node as { castOn: unknown }
    expect(piece.castOn).toBeNull()
  })
})

describe('setOperation', () => {
  it('rejects a finish-only kind on castOn', () => {
    const { content, pieceId } = withPieceAndSection()
    expect(() => setOperation(content, pieceId, 'castOn', { kind: 'bind_off' })).toThrow()
  })

  it('accepts the allowed kinds and keeps the operation id stable on update', () => {
    const { content, pieceId } = withPieceAndSection()
    const withCastOn = setOperation(content, pieceId, 'castOn', { kind: 'cast_on', stitches: 80 })
    const firstId = (findNode(withCastOn, pieceId)!.node as { castOn: { id: string } }).castOn.id
    const updated = setOperation(withCastOn, pieceId, 'castOn', { kind: 'cast_on', stitches: 90 })
    const secondId = (findNode(updated, pieceId)!.node as { castOn: { id: string; stitches: number } }).castOn
    expect(secondId.id).toBe(firstId)
    expect(secondId.stitches).toBe(90)
  })
})

describe('getParentAndIndex', () => {
  it('reports the section as the parent of a top-level block', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withBlock, id: blockId } = addBlock(content, sectionId, 'text', { text: 'a' })
    const info = getParentAndIndex(withBlock, blockId)
    expect(info).toEqual({ parentId: sectionId, listKind: 'blocks', index: 0, siblingCount: 1 })
  })
})

describe('computeNodeDepth', () => {
  it('increments by one for each nesting level', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withOuter, id: outerId } = addBlock(content, sectionId, 'repeat', { times: 1 })
    const { content: withInner, id: innerId } = addBlock(withOuter, outerId, 'repeat', { times: 1 })
    expect(computeNodeDepth(withInner, outerId)).toBe(1)
    expect(computeNodeDepth(withInner, innerId)).toBe(2)
  })
})

describe('parsePastedRows', () => {
  it('detects "Rang N :" prefixes and strips them', () => {
    const result = parsePastedRows('Rang 1 : *2m end, 2m env* rép\nRang 2 : tout en env')
    expect(result).toEqual([
      { number: 1, side: null, text: '*2m end, 2m env* rép' },
      { number: 2, side: null, text: 'tout en env' },
    ])
  })

  it('detects "R12", "Rg 12" and "12." prefixes', () => {
    const result = parsePastedRows('R1 avant\nRg 2 milieu\n3. fin')
    expect(result.map((row) => row.number)).toEqual([1, 2, 3])
    expect(result.map((row) => row.text)).toEqual(['avant', 'milieu', 'fin'])
  })

  it('detects a (END)/(ENV) side marker anywhere in the line', () => {
    const result = parsePastedRows('Rang 1 (END) : jersey endroit\nRang 2 (ENV) : jersey envers')
    expect(result[0]).toEqual({ number: 1, side: 'rs', text: 'jersey endroit' })
    expect(result[1]).toEqual({ number: 2, side: 'ws', text: 'jersey envers' })
  })

  it('drops empty lines and proposes the next number when none is given', () => {
    const result = parsePastedRows('Rang 5 : a\n\nb\nc')
    expect(result).toEqual([
      { number: 5, side: null, text: 'a' },
      { number: 6, side: null, text: 'b' },
      { number: 7, side: null, text: 'c' },
    ])
  })

  it('continues numbering from a given starting number', () => {
    const result = parsePastedRows('a\nb', 10)
    expect(result.map((row) => row.number)).toEqual([10, 11])
  })
})

describe('validateGuideContent', () => {
  it('accepts an empty guide', () => {
    expect(validateGuideContent(emptyGuideContent())).toEqual([])
  })

  it('accepts a well-formed guide', () => {
    const { content } = withPieceAndSection()
    expect(validateGuideContent(content)).toEqual([])
  })

  it('rejects a round section with a row that has a side', () => {
    const { content, sectionId } = withPieceAndSection()
    const round = updateNode(content, sectionId, { method: 'round' })
    const { content: withBlock, id: blockId } = addBlock(round, sectionId, 'rows')
    const { content: withRow } = addRow(withBlock, blockId, { side: 'rs' })
    const errors = validateGuideContent(withRow)
    expect(errors.some((error) => error.includes('en rond'))).toBe(true)
  })

  it('rejects duplicate ids', () => {
    const broken = {
      schemaVersion: 1,
      pieces: [
        { id: 'dup', name: 'Dos', castOn: null, sections: [], finish: null, notes: '' },
        { id: 'dup', name: 'Devant', castOn: null, sections: [], finish: null, notes: '' },
      ],
    }
    const errors = validateGuideContent(broken)
    expect(errors.some((error) => error.includes('en double'))).toBe(true)
  })

  it('rejects a cast_on-only kind used as a finish operation', () => {
    const { content, pieceId } = withPieceAndSection()
    const withFinish = setOperation(content, pieceId, 'finish', { kind: 'bind_off' })
    const broken = updateNode(withFinish, (findNode(withFinish, pieceId)!.node as { finish: { id: string } }).finish.id, { kind: 'cast_on' })
    const errors = validateGuideContent(broken)
    expect(errors.some((error) => error.includes("type d'opération invalide"))).toBe(true)
  })

  it('rejects a repeat with a non-positive times', () => {
    const { content, sectionId } = withPieceAndSection()
    const { content: withRepeat, id: repeatId } = addBlock(content, sectionId, 'repeat', { times: 1 })
    const broken = updateNode(withRepeat, repeatId, { times: 0 })
    const errors = validateGuideContent(broken)
    expect(errors.some((error) => error.includes('times'))).toBe(true)
  })
})

describe('normalizeGuideContent', () => {
  it('fills in missing ids', () => {
    const raw = { schemaVersion: 1, pieces: [{ name: 'Dos', castOn: null, sections: [], finish: null, notes: '' }] }
    const normalized = normalizeGuideContent(raw)
    expect(normalized.pieces[0]!.id).toBeTruthy()
  })

  it('resolves duplicate ids by regenerating the later occurrence', () => {
    const raw = {
      schemaVersion: 1,
      pieces: [
        { id: 'dup', name: 'Dos', castOn: null, sections: [], finish: null, notes: '' },
        { id: 'dup', name: 'Devant', castOn: null, sections: [], finish: null, notes: '' },
      ],
    }
    const normalized = normalizeGuideContent(raw)
    expect(normalized.pieces[0]!.id).toBe('dup')
    expect(normalized.pieces[1]!.id).not.toBe('dup')
    expect(validateGuideContent(normalized)).toEqual([])
  })

  it('clears a row side in a round section', () => {
    const raw = {
      schemaVersion: 1,
      pieces: [
        {
          id: 'p1',
          name: 'Manche',
          castOn: null,
          finish: null,
          notes: '',
          sections: [
            {
              id: 's1',
              name: 'Corps',
              method: 'round',
              blocks: [{ id: 'b1', type: 'rows', rows: [{ id: 'r1', number: 1, side: 'rs', text: 'jersey', stitchesAfter: null }] }],
            },
          ],
        },
      ],
    }
    const normalized = normalizeGuideContent(raw)
    expect(normalized.pieces[0]!.sections[0]!.blocks[0]).toMatchObject({ type: 'rows', rows: [{ side: null }] })
  })

  it('truncates blocks nested beyond the max depth instead of keeping them', () => {
    let raw: unknown = { type: 'text', text: 'leaf' }
    for (let level = 0; level < MAX_BLOCK_NESTING_DEPTH + 2; level += 1) {
      raw = { type: 'repeat', times: 1, blocks: [raw] }
    }
    const content = {
      schemaVersion: 1,
      pieces: [{ name: 'P', castOn: null, finish: null, notes: '', sections: [{ name: 'S', method: 'flat', blocks: [raw] }] }],
    }
    const normalized = normalizeGuideContent(content)
    expect(validateGuideContent(normalized)).toEqual([])
  })

  it('is a no-op on already-valid content (round-trips cleanly)', () => {
    const { content } = withPieceAndSection()
    const normalized = normalizeGuideContent(content)
    expect(validateGuideContent(normalized)).toEqual([])
  })
})
