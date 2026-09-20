import { describe, expect, it } from 'vitest'
import { classifyRavelryStatus, describeRavelryError } from './errors'

describe('classifyRavelryStatus', () => {
  it('classifies every documented HTTP status', () => {
    expect(classifyRavelryStatus(401)).toBe('invalid_credentials')
    expect(classifyRavelryStatus(403)).toBe('invalid_credentials')
    expect(classifyRavelryStatus(429)).toBe('rate_limited')
    expect(classifyRavelryStatus(503)).toBe('service_unavailable')
    expect(classifyRavelryStatus(504)).toBe('service_unavailable')
  })

  it('falls back to unexpected_response for anything else', () => {
    expect(classifyRavelryStatus(500)).toBe('unexpected_response')
    expect(classifyRavelryStatus(418)).toBe('unexpected_response')
  })
})

describe('describeRavelryError', () => {
  it('never mentions credentials in any error message', () => {
    const kinds = ['invalid_credentials', 'rate_limited', 'service_unavailable', 'network_unreachable', 'unexpected_response', 'cancelled'] as const
    for (const kind of kinds) {
      const message = describeRavelryError(kind)
      expect(message.toLowerCase()).not.toContain('username')
      expect(message.toLowerCase()).not.toContain('password')
      expect(message.toLowerCase()).not.toContain('identifiant:')
    }
  })
})
