import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { analyzeGuideImport, guideNameFromFileName, MAX_GUIDE_IMPORT_BYTES } from './guideImport'
import { createGuide, getGuide, getGuideContent } from './guidesRepository'
import { importPattern } from './patternsRepository'
import { validateGuideContent } from './guideTree'

// Invented, short guide — never a real pattern.
function sampleGuide(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    pieces: [
      {
        id: 'p1',
        name: 'Bonnet',
        category: 'other',
        customCategory: 'Bonnet',
        castOn: { id: 'op1', kind: 'cast_on', stitches: 80, joinMode: null, note: '' },
        sections: [
          {
            id: 's1',
            name: 'Côtes',
            category: 'ribbing',
            customCategory: '',
            method: 'round',
            blocks: [
              {
                id: 'b1',
                type: 'repeat',
                times: 3,
                blocks: [{ id: 'b2', type: 'rows', rows: [{ id: 'r1', number: 1, side: null, instructions: '*1 m end, 1 m env*', stitchesAfter: null }] }],
              },
            ],
          },
        ],
        finish: { id: 'op2', kind: 'bind_off', stitches: null, joinMode: null, note: '' },
        notes: '',
      },
    ],
    ...overrides,
  }
}

const json = (value: unknown) => JSON.stringify(value)

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('analyzeGuideImport', () => {
  it('accepts a valid guide and reports stats', () => {
    const result = analyzeGuideImport(json(sampleGuide()))
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.stats).toMatchObject({ pieceCount: 1, sectionCount: 1, blockCount: 2, knownRows: 3 })
    expect(result.notes).toEqual([])
  })

  it('reports broken JSON syntax with a clear message and no crash', () => {
    const result = analyzeGuideImport('{ "schemaVersion": 1, "pieces": [ ')
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/pas du JSON valide/)
  })

  it('reports plain prose as invalid JSON', () => {
    const result = analyzeGuideImport('Voici ton guide : commence par monter 80 mailles.')
    expect(result.status).toBe('invalid')
  })

  it('rejects empty text and non-object JSON', () => {
    expect(analyzeGuideImport('   ').status).toBe('invalid')
    expect(analyzeGuideImport('[1, 2]').status).toBe('invalid')
    expect(analyzeGuideImport('"texte"').status).toBe('invalid')
  })

  it('lists structural errors when there is nothing to repair', () => {
    const result = analyzeGuideImport(json({ schemaVersion: 1, pieces: 'oups' }))
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors.join(' ')).toMatch(/pieces/)
    expect(result.technical).toContain('docs/Guidespatrons.md')
  })

  it('rejects a guide without any piece', () => {
    const result = analyzeGuideImport(json({ schemaVersion: 1, pieces: [] }))
    expect(result.status).toBe('invalid')
  })

  it('rejects a schemaVersion newer than the app', () => {
    const result = analyzeGuideImport(json(sampleGuide({ schemaVersion: 2 })))
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors[0]).toMatch(/plus récente/)
  })

  it('upgrades an older schemaVersion and says so', () => {
    const result = analyzeGuideImport(json(sampleGuide({ schemaVersion: 0 })))
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.content.schemaVersion).toBe(1)
    expect(result.notes.join(' ')).toMatch(/Ancienne version/)
  })

  it('proposes a repair (never applied silently) with a summary of corrections', () => {
    const guide = sampleGuide()
    delete (guide.pieces[0] as Record<string, unknown>).customCategory
    ;(guide.pieces[0]!.sections[0]!.blocks[0] as Record<string, unknown>).times = 0
    const result = analyzeGuideImport(json(guide))
    expect(result.status).toBe('repairable')
    if (result.status !== 'repairable') return
    expect(result.corrections.length).toBeGreaterThanOrEqual(2)
    expect(result.removesContent).toBe(false)
    expect(validateGuideContent(result.content)).toEqual([])
  })

  it('assigns fresh ids when they are missing or duplicated', () => {
    const guide = sampleGuide()
    guide.pieces[0]!.sections[0]!.id = 'p1'
    const result = analyzeGuideImport(json(guide))
    expect(result.status).toBe('repairable')
    if (result.status !== 'repairable') return
    const ids = [result.content.pieces[0]!.id, result.content.pieces[0]!.sections[0]!.id]
    expect(new Set(ids).size).toBe(2)
  })

  it('warns when the repair would remove content', () => {
    const guide = sampleGuide()
    guide.pieces[0]!.sections[0]!.blocks.push({ id: 'b9', type: 'mystery' } as never)
    const result = analyzeGuideImport(json(guide))
    expect(result.status).toBe('repairable')
    if (result.status !== 'repairable') return
    expect(result.removesContent).toBe(true)
  })

  it('strips a markdown code fence around the JSON and says so', () => {
    const result = analyzeGuideImport('```json\n' + json(sampleGuide()) + '\n```')
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.notes.join(' ')).toMatch(/bloc de code/)
  })

  it('reads optional name, craft and size hints', () => {
    const result = analyzeGuideImport(json(sampleGuide({ name: ' Bonnet simple ', craft: 'tricot', sizeLabel: 'M' })))
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.hints).toEqual({ name: 'Bonnet simple', craft: 'knitting', sizeLabel: 'M' })
  })

  it('rejects very large text cleanly', () => {
    const result = analyzeGuideImport('x'.repeat(MAX_GUIDE_IMPORT_BYTES + 1))
    expect(result.status).toBe('invalid')
    if (result.status !== 'invalid') return
    expect(result.errors[0]).toMatch(/trop volumineux/)
  })
})

describe('guideNameFromFileName', () => {
  it('drops the extension and underscores', () => {
    expect(guideNameFromFileName('mon_guide.json')).toBe('mon guide')
  })
})

describe('creating a guide from an import', () => {
  it('stores guide and content together', async () => {
    const analysis = analyzeGuideImport(json(sampleGuide()))
    if (analysis.status !== 'valid') throw new Error('expected valid')
    const guide = await createGuide({ name: 'Bonnet', craft: 'knitting', content: analysis.content })
    expect(await getGuide(guide.id)).toBeDefined()
    expect(await getGuideContent(guide.id)).toEqual(analysis.content)
  })

  it('writes nothing when the transaction fails', async () => {
    await expect(createGuide({ name: 'Bonnet', content: { toJSON() { throw new Error('boom') } } as never })).rejects.toBeDefined()
    expect(await db.guides.count()).toBe(0)
    expect(await db.guideContents.count()).toBe(0)
  })

  it('keeps the pattern link when importing from a pattern page', async () => {
    const pattern = await importPattern({
      name: 'Bonnet',
      craft: 'knitting',
      fileName: 'bonnet.pdf',
      fileHash: 'hash-import',
      pageCount: 2,
      sizeBytes: 10,
      fileBlob: new Blob(['%PDF-fake']),
      coverBlob: new Blob(['cover']),
    })
    const analysis = analyzeGuideImport(json(sampleGuide()))
    if (analysis.status !== 'valid') throw new Error('expected valid')
    const guide = await createGuide({ name: 'Bonnet', patternId: pattern.id, content: analysis.content })
    expect((await getGuide(guide.id))?.patternId).toBe(pattern.id)
  })
})
