import { describe, expect, it } from 'vitest'
import { diffWords } from './diff'

const join = (parts: ReturnType<typeof diffWords>, ...types: string[]) =>
  parts.filter((p) => types.includes(p.type)).map((p) => p.text).join('')

describe('diffWords', () => {
  it('reports identical text as a single same part', () => {
    expect(diffWords('The cat sat.', 'The cat sat.')).toEqual([{ type: 'same', text: 'The cat sat.' }])
  })
  it('marks a pure insertion', () => {
    const d = diffWords('The cat sat.', 'The black cat sat.')
    expect(d.some((p) => p.type === 'del')).toBe(false)
    expect(join(d, 'ins').trim()).toBe('black')
    expect(join(d, 'same', 'ins')).toBe('The black cat sat.')
  })
  it('marks a replacement as del + ins and rebuilds both sides', () => {
    const o = 'We utilize a method.'
    const r = 'We use a method.'
    const d = diffWords(o, r)
    expect(join(d, 'del').trim()).toBe('utilize')
    expect(join(d, 'ins').trim()).toBe('use')
    expect(join(d, 'same', 'del')).toBe(o)
    expect(join(d, 'same', 'ins')).toBe(r)
  })
  it('handles punctuation changes', () => {
    const o = 'Hello, world.'
    const r = 'Hello world!'
    const d = diffWords(o, r)
    expect(join(d, 'same', 'del')).toBe(o)
    expect(join(d, 'same', 'ins')).toBe(r)
    expect(d.some((p) => p.type !== 'same')).toBe(true)
  })
})
