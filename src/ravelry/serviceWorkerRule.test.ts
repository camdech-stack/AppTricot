import { describe, expect, it } from 'vitest'
import { RAVELRY_RUNTIME_CACHING_RULE } from './serviceWorkerRule'

describe('RAVELRY_RUNTIME_CACHING_RULE', () => {
  it('matches api.ravelry.com requests', () => {
    expect(RAVELRY_RUNTIME_CACHING_RULE.urlPattern.test('https://api.ravelry.com/yarns/search.json?query=wool')).toBe(true)
  })

  it('does not match other origins, including look-alikes', () => {
    expect(RAVELRY_RUNTIME_CACHING_RULE.urlPattern.test('https://not-api.ravelry.com/yarns/search.json')).toBe(false)
    expect(RAVELRY_RUNTIME_CACHING_RULE.urlPattern.test('https://ravelry.com/api.ravelry.com/x')).toBe(false)
    expect(RAVELRY_RUNTIME_CACHING_RULE.urlPattern.test('https://example.com/')).toBe(false)
  })

  it('uses the NetworkOnly strategy — never reads or writes a cache', () => {
    expect(RAVELRY_RUNTIME_CACHING_RULE.handler).toBe('NetworkOnly')
  })
})
