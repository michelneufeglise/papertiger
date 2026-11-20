import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { iwaDecompress, iwaStorageTexts, pagesToText, snappyDecompress } from './pages'

function varint(n: number): number[] {
  const out: number[] = []
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n = Math.floor(n / 128)
  }
  out.push(n)
  return out
}
const enc = (s: string) => Array.from(new TextEncoder().encode(s))
const ld = (field: number, bytes: number[]) => [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes]
const vi = (field: number, v: number) => [...varint(field * 8), ...varint(v)]

/** One archive = [varint len][ArchiveInfo][payload]. */
function archive(id: number, type: number, payload: number[]): number[] {
  const messageInfo = [...vi(1, type), ...vi(3, payload.length)]
  const info = [...vi(1, id), ...ld(2, messageInfo)]
  return [...varint(info.length), ...info, ...payload]
}

/** Snappy block with a single literal (and optionally a back-reference copy). */
function snappyLiteral(data: number[]): number[] {
  const n = data.length - 1
  const head = n < 60 ? [n << 2] : n < 256 ? [60 << 2, n] : [61 << 2, n & 0xff, n >> 8]
  return [...varint(data.length), ...head, ...data]
}

function iwa(...chunks: number[][]): Uint8Array {
  const out: number[] = []
  for (const c of chunks) {
    const comp = snappyLiteral(c)
    out.push(0, comp.length & 0xff, (comp.length >> 8) & 0xff, (comp.length >> 16) & 0xff, ...comp)
  }
  return Uint8Array.from(out)
}

function storage(text: string[]): number[] {
  return [...vi(1, 0), ...text.flatMap(t => ld(3, enc(t)))]
}

describe('snappyDecompress', () => {
  it('decodes literals and copies', () => {
    // "abcabcabc": literal "abc" then copy1 len 6 offset 3
    const lit = [0x02 << 2 | 0, ...enc('abc')]
    const copy = [((6 - 4) << 2) | 1 | ((3 >> 8) << 5), 3]
    expect(new TextDecoder().decode(snappyDecompress(Uint8Array.from([9, ...lit, ...copy])))).toBe('abcabcabc')
  })
  it('rejects truncated data', () => {
    expect(() => snappyDecompress(Uint8Array.from([5, 0x04, 0x61]))).toThrow()
  })
})

describe('iwa parsing', () => {
  it('collects StorageArchive text across chunks, ignoring other messages', () => {
    const stream = iwa(
      [...archive(1, 2001, storage(['Hello world\nSecond line'])), ...archive(2, 6000, enc('ignore me'))],
      archive(3, 2001, storage(['Another storage'])),
    )
    expect(iwaStorageTexts(iwaDecompress(stream))).toEqual(['Hello world\nSecond line', 'Another storage'])
  })
})

describe('pagesToText', () => {
  it('reads paragraphs from Index/Document.iwa', async () => {
    const zip = new JSZip()
    zip.file('Index/Document.iwa', iwa(archive(1, 2001, storage(['Title line\nBody paragraph￼.\n']))))
    zip.file('Metadata/Properties.plist', 'x')
    const r = await pagesToText(await zip.generateAsync({ type: 'uint8array' }))
    expect(r.text).toBe('Title line\n\nBody paragraph.')
    expect(r.note).toBeUndefined()
  })

  it('falls back to OCR of preview.jpg with a note', async () => {
    const zip = new JSZip()
    zip.file('Index/Document.iwa', iwa(archive(1, 6000, enc('nothing'))))
    zip.file('preview.jpg', new Uint8Array([1, 2, 3]))
    const r = await pagesToText(await zip.generateAsync({ type: 'uint8array' }), async () => 'ocr text')
    expect(r.text).toBe('ocr text')
    expect(r.note).toMatch(/first page/i)
  })

  it('reports old bundle-style files as unsupported', async () => {
    await expect(pagesToText(new TextEncoder().encode('not a zip'))).rejects.toThrow(/old bundle/)
  })
})
