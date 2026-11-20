// Apple Pages (.pages): a zip whose Index/*.iwa files hold snappy-framed protobuf archives.
// We walk each IWA, find TSWP.StorageArchive messages (type 2001) and collect their text (field 3).
// If nothing can be read, the package's preview.jpg is OCR'd instead (first page only).
import JSZip from 'jszip'

/** Raw snappy block decompression (no stream framing). */
export function snappyDecompress(src: Uint8Array): Uint8Array {
  let pos = 0
  let len = 0
  for (let shift = 0; ; shift += 7) {
    if (pos >= src.length) throw new Error('Corrupt snappy data.')
    const b = src[pos++]
    len |= (b & 0x7f) << shift
    if (!(b & 0x80)) break
  }
  const out = new Uint8Array(len)
  let o = 0
  while (pos < src.length && o < len) {
    const tag = src[pos++]
    const type = tag & 3
    if (type === 0) {
      let n = tag >> 2
      if (n >= 60) {
        const extra = n - 59
        n = 0
        for (let k = 0; k < extra; k++) n |= src[pos++] << (8 * k)
      }
      n += 1
      if (pos + n > src.length || o + n > len) throw new Error('Corrupt snappy literal.')
      out.set(src.subarray(pos, pos + n), o)
      pos += n
      o += n
    } else {
      let n: number
      let offset: number
      if (type === 1) {
        n = 4 + ((tag >> 2) & 7)
        offset = ((tag >> 5) << 8) | src[pos++]
      } else if (type === 2) {
        n = (tag >> 2) + 1
        offset = src[pos] | (src[pos + 1] << 8)
        pos += 2
      } else {
        n = (tag >> 2) + 1
        offset = (src[pos] | (src[pos + 1] << 8) | (src[pos + 2] << 16) | (src[pos + 3] << 24)) >>> 0
        pos += 4
      }
      if (offset === 0 || offset > o || o + n > len) throw new Error('Corrupt snappy copy.')
      for (let k = 0; k < n; k++) {
        out[o] = out[o - offset]
        o++
      }
    }
  }
  if (o !== len) throw new Error('Truncated snappy data.')
  return out
}

/** Concatenated decompressed payload of an IWA file: chunks of [0x00][3-byte LE length][snappy data]. */
export function iwaDecompress(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  let total = 0
  let pos = 0
  while (pos + 4 <= data.length) {
    if (data[pos] !== 0) throw new Error('Unexpected IWA chunk header.')
    const n = data[pos + 1] | (data[pos + 2] << 8) | (data[pos + 3] << 16)
    pos += 4
    if (pos + n > data.length) throw new Error('Truncated IWA chunk.')
    const part = snappyDecompress(data.subarray(pos, pos + n))
    parts.push(part)
    total += part.length
    pos += n
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

interface Reader {
  buf: Uint8Array
  pos: number
}

function readVarint(r: Reader): number {
  let result = 0
  let mul = 1
  for (;;) {
    if (r.pos >= r.buf.length) throw new Error('Truncated varint.')
    const b = r.buf[r.pos++]
    result += (b & 0x7f) * mul
    if (!(b & 0x80)) return result
    mul *= 128
    if (mul > 2 ** 56) throw new Error('Varint too long.')
  }
}

interface Field {
  num: number
  wire: number
  value: number // varint value, or length-delimited length
  bytes?: Uint8Array
}

function* fields(buf: Uint8Array): Generator<Field> {
  const r: Reader = { buf, pos: 0 }
  while (r.pos < buf.length) {
    const key = readVarint(r)
    const num = Math.floor(key / 8)
    const wire = key & 7
    if (wire === 0) yield { num, wire, value: readVarint(r) }
    else if (wire === 2) {
      const n = readVarint(r)
      if (r.pos + n > buf.length) throw new Error('Truncated field.')
      yield { num, wire, value: n, bytes: buf.subarray(r.pos, r.pos + n) }
      r.pos += n
    } else if (wire === 1) {
      r.pos += 8
    } else if (wire === 5) {
      r.pos += 4
    } else throw new Error('Unsupported protobuf wire type.')
  }
}

const STORAGE_ARCHIVE = 2001

/** Texts of every TSWP.StorageArchive in a decompressed IWA stream, in file order. */
export function iwaStorageTexts(stream: Uint8Array): string[] {
  const texts: string[] = []
  const r: Reader = { buf: stream, pos: 0 }
  const dec = new TextDecoder('utf-8')
  while (r.pos < stream.length) {
    const infoLen = readVarint(r)
    const info = stream.subarray(r.pos, r.pos + infoLen)
    r.pos += infoLen
    const messages: { type: number; length: number }[] = []
    for (const f of fields(info)) {
      if (f.num === 2 && f.bytes) {
        let type = 0
        let length = 0
        for (const mf of fields(f.bytes)) {
          if (mf.num === 1 && mf.wire === 0) type = mf.value
          else if (mf.num === 3 && mf.wire === 0) length = mf.value
        }
        messages.push({ type, length })
      }
    }
    for (const m of messages) {
      const payload = stream.subarray(r.pos, r.pos + m.length)
      r.pos += m.length
      if (m.type !== STORAGE_ARCHIVE) continue
      try {
        for (const f of fields(payload)) {
          if (f.num === 3 && f.wire === 2 && f.bytes) texts.push(dec.decode(f.bytes))
        }
      } catch {
        // A storage we cannot walk is skipped.
      }
    }
  }
  return texts
}

function storageTextToMarkdown(texts: string[]): string {
  const paras: string[] = []
  for (const t of texts) {
    // oxlint-disable-next-line no-control-regex
    for (const line of t.replace(/\r\n?/g, '\n').split(/[\n\u2028\u2029\u000b]/)) {
      // oxlint-disable-next-line no-control-regex
      const p = line.replace(/[\uFFFC\u0000-\u0008\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').trim()
      if (p) paras.push(p)
    }
  }
  return paras.join('\n\n')
}

export interface PagesResult {
  text: string
  note?: string
}

export async function pagesToText(
  bytes: Uint8Array,
  ocr?: (jpeg: Uint8Array) => Promise<string>,
): Promise<PagesResult> {
  // Zip magic "PK"; the pre-2013 bundle format is a folder, not a file.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('This Pages file is an old bundle-style document. Open it in Pages and export it as .docx.')
  }
  const zip = await JSZip.loadAsync(bytes)

  const iwaNames = Object.keys(zip.files).filter(n => /^Index\/.+\.iwa$/i.test(n) && !zip.files[n].dir)
  if (iwaNames.length === 0 && zip.file('index.xml')) {
    throw new Error('This Pages file uses the old XML format. Open it in Pages and export it as .docx.')
  }
  // Body text lives in Document.iwa; fall back to every other IWA only when that yields nothing.
  const ordered = [
    ...iwaNames.filter(n => /Document\.iwa$/i.test(n)),
    ...iwaNames.filter(n => !/Document\.iwa$/i.test(n) && !/Metadata|Annotation|ViewState|DocumentStylesheet/i.test(n)),
  ]
  for (const group of [ordered.slice(0, 1), ordered.slice(1)]) {
    const texts: string[] = []
    for (const name of group) {
      try {
        const data = await zip.file(name)!.async('uint8array')
        texts.push(...iwaStorageTexts(iwaDecompress(data)))
      } catch {
        // Unreadable chunk: try the next file.
      }
    }
    const md = storageTextToMarkdown(texts)
    if (md.trim()) return { text: md }
  }

  const preview = zip.file(/(^|\/)preview\.jpe?g$/i)[0]
  if (preview && ocr) {
    const text = await ocr(await preview.async('uint8array'))
    if (text.trim()) return { text, note: 'Only the first page could be read (from the preview image).' }
  }
  throw new Error('Could not read the text of this Pages file. Open it in Pages and export it as .docx.')
}
