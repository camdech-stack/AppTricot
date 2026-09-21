import { describe, expect, it } from 'vitest'
import { findMaterialLines, groupTextIntoLines, guessCreatorFromLines, guessTitleFromLines, isMaterialLine, type PdfTextFragment } from './patternTextHeuristics'

function fragment(str: string, height: number, hasEOL = false): PdfTextFragment {
  return { str, height, hasEOL }
}

describe('groupTextIntoLines', () => {
  it('joins fragments up to hasEOL into a single line, keeping the tallest height', () => {
    const items = [fragment('Pull ', 24), fragment('torsadé', 28, true), fragment('par Marie', 10, true)]
    const lines = groupTextIntoLines(items)
    expect(lines).toEqual([
      { text: 'Pull torsadé', maxHeight: 28 },
      { text: 'par Marie', maxHeight: 10 },
    ])
  })

  it('flushes a trailing line even without a final hasEOL', () => {
    const items = [fragment('Sans point final', 12)]
    expect(groupTextIntoLines(items)).toEqual([{ text: 'Sans point final', maxHeight: 12 }])
  })

  it('drops blank lines', () => {
    const items = [fragment('   ', 12, true), fragment('Titre', 20, true)]
    expect(groupTextIntoLines(items)).toEqual([{ text: 'Titre', maxHeight: 20 }])
  })
})

describe('guessTitleFromLines', () => {
  it('picks the line with the largest font height', () => {
    const lines = [
      { text: 'par Marie Dupont', maxHeight: 10 },
      { text: 'Pull torsadé', maxHeight: 32 },
      { text: 'Taille unique', maxHeight: 14 },
    ]
    expect(guessTitleFromLines(lines)).toBe('Pull torsadé')
  })

  it('works the same for an English pattern', () => {
    const lines = [
      { text: 'by Jane Doe', maxHeight: 10 },
      { text: 'Cabled Sweater', maxHeight: 30 },
    ]
    expect(guessTitleFromLines(lines)).toBe('Cabled Sweater')
  })

  it('ignores lines outside the plausible title length range', () => {
    const lines = [
      { text: 'A', maxHeight: 40 },
      { text: 'x'.repeat(200), maxHeight: 35 },
      { text: 'Bonnet rayé', maxHeight: 20 },
    ]
    expect(guessTitleFromLines(lines)).toBe('Bonnet rayé')
  })

  it('returns null when there are no plausible candidates', () => {
    expect(guessTitleFromLines([])).toBeNull()
  })
})

describe('guessCreatorFromLines', () => {
  it('matches common French byline phrasings', () => {
    expect(guessCreatorFromLines([{ text: 'Par Marie Dupont', maxHeight: 10 }])).toBe('Marie Dupont')
    expect(guessCreatorFromLines([{ text: 'Conçu par Alice Martin', maxHeight: 10 }])).toBe('Alice Martin')
    expect(guessCreatorFromLines([{ text: 'Un modèle de Clara Petit', maxHeight: 10 }])).toBe('Clara Petit')
    expect(guessCreatorFromLines([{ text: 'Créatrice : Sophie Leroy', maxHeight: 10 }])).toBe('Sophie Leroy')
  })

  it('matches common English byline phrasings', () => {
    expect(guessCreatorFromLines([{ text: 'Designed by Jane Doe', maxHeight: 10 }])).toBe('Jane Doe')
    expect(guessCreatorFromLines([{ text: 'Pattern by John Smith', maxHeight: 10 }])).toBe('John Smith')
    expect(guessCreatorFromLines([{ text: 'by Emma Wilson', maxHeight: 10 }])).toBe('Emma Wilson')
  })

  it('strips trailing punctuation from the captured name', () => {
    expect(guessCreatorFromLines([{ text: 'Designed by Jane Doe.', maxHeight: 10 }])).toBe('Jane Doe')
  })

  it('only matches at the start of a line, not mid-sentence', () => {
    expect(guessCreatorFromLines([{ text: 'Tricoter 4 rangs par le devant', maxHeight: 10 }])).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(guessCreatorFromLines([{ text: 'Taille : S/M/L', maxHeight: 10 }])).toBeNull()
  })
})

describe('isMaterialLine', () => {
  it('requires both a tool keyword and a measurement', () => {
    expect(isMaterialLine('Aiguilles circulaires 4 mm, 80 cm')).toBe(true)
    expect(isMaterialLine('US 6 (4mm) circular needles, 32in')).toBe(true)
    expect(isMaterialLine('Crochet 3,5 mm')).toBe(true)
  })

  it('rejects a tool mention with no measurement', () => {
    expect(isMaterialLine("Reprendre les mailles avec l'aiguille auxiliaire")).toBe(false)
  })

  it('rejects a measurement with no tool mention', () => {
    expect(isMaterialLine('Longueur totale : 60 cm')).toBe(false)
  })
})

describe('findMaterialLines', () => {
  it('collects unique matching lines in order, in either language', () => {
    const lines = [
      { text: 'Matériel', maxHeight: 16 },
      { text: 'Aiguilles circulaires 4 mm, 80 cm', maxHeight: 10 },
      { text: '2 marqueurs de mailles', maxHeight: 10 },
      { text: 'Crochet 3,5 mm pour la bordure', maxHeight: 10 },
      { text: 'aiguilles circulaires 4 mm, 80 cm', maxHeight: 10 },
    ]
    expect(findMaterialLines(lines)).toEqual(['Aiguilles circulaires 4 mm, 80 cm', 'Crochet 3,5 mm pour la bordure'])
  })

  it('caps the number of collected lines', () => {
    const lines = Array.from({ length: 20 }, (_, index) => ({ text: `Aiguilles ${index} mm`, maxHeight: 10 }))
    expect(findMaterialLines(lines)).toHaveLength(10)
  })
})
