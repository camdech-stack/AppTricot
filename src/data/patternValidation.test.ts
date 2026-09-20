import { describe, expect, it } from 'vitest'
import { defaultPatternName, validatePdfSignature } from './patternValidation'

function bytesFrom(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe('validatePdfSignature', () => {
  it('accepts a file starting with the %PDF signature', () => {
    expect(validatePdfSignature(bytesFrom('%PDF-1.7\n...'))).toBeNull()
  })

  it('rejects an empty file', () => {
    expect(validatePdfSignature(new ArrayBuffer(0))).toBe('empty')
  })

  it('rejects a file with the wrong signature (bad type)', () => {
    expect(validatePdfSignature(bytesFrom('PK\x03\x04 not a pdf'))).toBe('invalid')
  })
})

describe('defaultPatternName', () => {
  it('strips the .pdf extension', () => {
    expect(defaultPatternName('Pull torsades.pdf')).toBe('Pull torsades')
  })

  it('is case-insensitive on the extension', () => {
    expect(defaultPatternName('Chaussettes.PDF')).toBe('Chaussettes')
  })

  it('falls back to the raw file name when nothing remains after stripping', () => {
    expect(defaultPatternName('.pdf')).toBe('.pdf')
  })
})
