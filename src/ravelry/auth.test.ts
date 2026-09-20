import { describe, expect, it } from 'vitest'
import { buildRavelryAuthHeader } from './auth'

describe('buildRavelryAuthHeader', () => {
  it('builds a Basic auth header from fictitious credentials', () => {
    const header = buildRavelryAuthHeader({ username: 'test-user', password: 'test-pass' })
    expect(header).toBe(`Basic ${btoa('test-user:test-pass')}`)
  })

  it('never appears with the raw credentials embedded in plain text', () => {
    const header = buildRavelryAuthHeader({ username: 'test-user', password: 'super-secret' })
    expect(header).not.toContain('test-user')
    expect(header).not.toContain('super-secret')
  })

  it('handles accented characters without throwing (btoa alone would reject them)', () => {
    expect(() => buildRavelryAuthHeader({ username: 'testeur', password: 'motdepasseàété' })).not.toThrow()
  })
})
