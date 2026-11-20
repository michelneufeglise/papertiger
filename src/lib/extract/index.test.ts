// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { ALL_EXTENSIONS, OCR_EXTENSIONS, TEXT_EXTENSIONS, extractText, needsApp } from './index'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const enc = (s: string) => new TextEncoder().encode(s)

describe('extractText', () => {
  it('lists every extension once', () => {
    expect(new Set(ALL_EXTENSIONS).size).toBe(TEXT_EXTENSIONS.length + OCR_EXTENSIONS.length)
    expect(ALL_EXTENSIONS).toEqual(expect.arrayContaining(['pages', 'doc', 'pdf', 'heic']))
  })
  it('needsApp covers textutil formats', () => {
    expect(['doc', 'webarchive', 'wordml'].every(needsApp)).toBe(true)
    expect(needsApp('docx')).toBe(false)
  })
  it('routes by extension', async () => {
    expect(await extractText('a.md', enc('# T\n\ntext'))).toBe('# T\n\ntext')
    expect(await extractText('a.HTML', enc('<h2>H</h2><p>p</p>'))).toBe('## H\n\np')
    expect(await extractText('a.rtf', enc('{\\rtf1 Hi\\par}'))).toBe('Hi')
  })
  it('asks to open .doc in the app without a Tauri path', async () => {
    await expect(extractText('a.doc', enc('x'))).rejects.toThrow('Open this file in the app')
  })
  it('rejects empty and unknown files', async () => {
    await expect(extractText('a.txt', enc('  '))).rejects.toThrow(/No text/)
    await expect(extractText('a.xyz', enc('x'))).rejects.toThrow(/Unsupported/)
  })
})
