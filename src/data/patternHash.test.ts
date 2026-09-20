import { describe, expect, it } from 'vitest'
import { hashBytes } from './patternHash'

function bytesFrom(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe('hashBytes', () => {
  it('computes the SHA-256 hex digest', async () => {
    expect(await hashBytes(bytesFrom('hello'))).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('is stable for identical content and differs otherwise', async () => {
    const a = await hashBytes(bytesFrom('patron A'))
    const b = await hashBytes(bytesFrom('patron A'))
    const c = await hashBytes(bytesFrom('patron B'))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
