import { describe, expect, it } from 'vitest'
import { formatFileSize } from './formatFileSize'

describe('formatFileSize', () => {
  it('formats bytes without decimals', () => {
    expect(formatFileSize(512)).toBe('512 o')
  })

  it('formats kilobytes without decimals', () => {
    expect(formatFileSize(2048)).toBe('2 Ko')
  })

  it('formats megabytes with one decimal under 10', () => {
    expect(formatFileSize(3.4 * 1024 * 1024)).toBe('3,4 Mo')
  })

  it('formats megabytes without decimals at 10 and above', () => {
    expect(formatFileSize(15 * 1024 * 1024)).toBe('15 Mo')
  })

  it('treats zero and negative sizes as 0 o', () => {
    expect(formatFileSize(0)).toBe('0 o')
    expect(formatFileSize(-5)).toBe('0 o')
  })
})
