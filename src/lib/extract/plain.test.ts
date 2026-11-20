import { describe, expect, it } from 'vitest'
import { plainToText } from './plain'

describe('plainToText', () => {
  it('decodes utf-8 and strips a BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('héllo\r\nworld')])
    expect(plainToText(bytes)).toBe('héllo\nworld')
  })
  it('detects UTF-16 LE with BOM', () => {
    const body = 'Grüße'
    const bytes = new Uint8Array(2 + body.length * 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let i = 0; i < body.length; i++) {
      bytes[2 + i * 2] = body.charCodeAt(i) & 0xff
      bytes[3 + i * 2] = body.charCodeAt(i) >> 8
    }
    expect(plainToText(bytes)).toBe('Grüße')
  })
  it('detects BOM-less UTF-16 BE', () => {
    const body = 'Plain text here'
    const bytes = new Uint8Array(body.length * 2)
    for (let i = 0; i < body.length; i++) bytes[i * 2 + 1] = body.charCodeAt(i)
    expect(plainToText(bytes)).toBe(body)
  })
})
