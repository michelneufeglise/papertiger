import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { exportDocument, EXPORT_FORMATS, type ExportFormat } from './index'
import { buildRtf, rtfEscape } from './rtf'
import { buildHtml } from './html'
import { pdfSafe } from './pdf'
import { toView } from '../render'
import { segmentText } from '../segment'

const TEXT =
  '# Kop\n\nEen gewone alinea met genoeg woorden erin <b>.\n\n- Eerste lijstitem met genoeg woorden erin.\n1. Genummerd item met genoeg woorden erin.\n\n| Naam | Jaar |\n|---|---|\n| Anguissola | 1535 |'
const blocks = segmentText(TEXT)
const para = blocks.find((b) => b.text.startsWith('Een gewone'))!
const outputs = { [para.idx]: 'Herschreven alinea é ≥ 3.' }

const read = async (b: Blob | { html: string }) => ('html' in b ? b.html : await b.text())

describe('rtf', () => {
  it('escapes specials and non-ASCII', () => {
    expect(rtfEscape('a\\b{c}d')).toBe('a\\\\b\\{c\\}d')
    expect(rtfEscape('é')).toBe("\\u233\\'3f")
    expect(rtfEscape('€')).toBe("\\u8364\\'3f")
    expect(rtfEscape('😀')).toBe("\\u-10179\\'3f\\u-8704\\'3f")
    expect(rtfEscape('舦')).toBe("\\u-32218\\'3f")
  })
  it('has headings, paragraphs and a table', () => {
    const rtf = buildRtf('Titel', toView(blocks, outputs))
    expect(rtf.startsWith('{\\rtf1')).toBe(true)
    expect(rtf).toContain('\\b\\fs36 Kop')
    expect(rtf).toContain('\\par')
    expect(rtf).toContain('\\trowd')
    expect(rtf).toContain("Herschreven alinea \\u233\\'3f \\u8805\\'3f 3.")
  })
})

describe('odt', () => {
  it('has the parts, mimetype first and stored', async () => {
    const blob = (await exportDocument('odt', 'Titel', blocks, outputs)) as Blob
    const buf = new Uint8Array(await blob.arrayBuffer())
    const head = new TextDecoder('latin1').decode(buf.subarray(0, 120))
    expect(head).toContain('mimetypeapplication/vnd.oasis.opendocument.text')
    expect(buf[8] | (buf[9] << 8)).toBe(0) // compression method 0 = stored
    const zip = await JSZip.loadAsync(buf)
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['mimetype', 'content.xml', 'styles.xml', 'META-INF/manifest.xml']))
    expect(Object.keys(zip.files)[0]).toBe('mimetype')
    const content = await zip.file('content.xml')!.async('string')
    expect(content).toContain('<text:h')
    expect(content).toContain('<text:list')
    expect(content).toContain('Herschreven alinea')
    expect(content).toContain('Anguissola')
  })
})

describe('pdf', () => {
  it('maps characters outside WinAnsi', () => {
    expect(pdfSafe('a ≥ b → c')).toBe('a >= b -> c')
    expect(pdfSafe('“quoted” é')).toBe('“quoted” é')
  })
  it('starts with %PDF and paginates long input', async () => {
    const long = Array.from({ length: 80 }, (_, i) => `Alinea ${i} ` + 'woord '.repeat(60)).join('\n\n')
    const bs = segmentText(long)
    const blob = (await exportDocument('pdf', 'Lang', bs, {})) as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(3)
  })
  it('handles a short document on one page', async () => {
    const blob = (await exportDocument('pdf', 'T', blocks, outputs)) as Blob
    expect((await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()))).getPageCount()).toBe(1)
  })
})

describe('html', () => {
  it('escapes markup', () => {
    const html = buildHtml('A & B', toView(blocks, outputs))
    expect(html).toContain('<title>A &amp; B</title>')
    expect(html).toContain('Herschreven alinea')
    expect(html).not.toContain('<b>')
    expect(html).toContain('<table>')
  })
})

describe('all formats', () => {
  it('include the reviewed text and not the original', async () => {
    for (const f of EXPORT_FORMATS.map((x) => x.id) as ExportFormat[]) {
      const data = await exportDocument(f, 'Titel', blocks, outputs)
      if (f === 'docx' || f === 'odt') {
        const zip = await JSZip.loadAsync(await (data as Blob).arrayBuffer())
        const name = f === 'docx' ? 'word/document.xml' : 'content.xml'
        const xml = await zip.file(name)!.async('string')
        expect(xml, f).toContain('Herschreven alinea')
        expect(xml, f).not.toContain('Een gewone alinea')
      } else if (f === 'pdf') {
        const doc = await PDFDocument.load(new Uint8Array(await (data as Blob).arrayBuffer()))
        expect(doc.getPageCount(), f).toBe(1)
      } else {
        const s = await read(data)
        expect(s, f).toContain('Herschreven alinea')
        expect(s, f).not.toContain('Een gewone alinea')
      }
    }
  })
  it('txt underlines headings; md keeps markdown', async () => {
    expect(await read(await exportDocument('txt', 'Titel', blocks, outputs))).toContain('Kop\n===')
    expect(await read(await exportDocument('md', 'Titel', blocks, outputs))).toContain('# Kop')
  })
})
