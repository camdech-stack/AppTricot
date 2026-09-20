import { describe, expect, it } from 'vitest'
import { normalizeTags, suggestTags } from './tagUtils'

describe('normalizeTags', () => {
  it('trims whitespace and collapses internal runs', () => {
    expect(normalizeTags(['  torsades  faciles  '])).toEqual(['torsades faciles'])
  })

  it('deduplicates case-insensitively, keeping the first casing', () => {
    expect(normalizeTags(['Bébé', 'bébé', 'BÉBÉ'])).toEqual(['Bébé'])
  })

  it('drops empty entries', () => {
    expect(normalizeTags(['pull', '   ', ''])).toEqual(['pull'])
  })
})

describe('suggestTags', () => {
  it('excludes tags already applied to the pattern, case-insensitively', () => {
    expect(suggestTags(['Pull', 'écharpe', 'bébé'], ['pull'])).toEqual(['bébé', 'écharpe'])
  })
})
