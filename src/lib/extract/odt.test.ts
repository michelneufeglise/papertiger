// @vitest-environment happy-dom
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { odtToText } from './odt'

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"'

describe('odtToText', () => {
  it('reads headings, paragraphs, lists and tables', async () => {
    const xml = `<?xml version="1.0"?><office:document-content ${NS}><office:body><office:text>
      <text:h text:outline-level="1">Title</text:h>
      <text:p>Hello<text:s text:c="2"/>there <text:span>styled</text:span>.</text:p>
      <text:list><text:list-item><text:p>Item one</text:p></text:list-item><text:list-item><text:p>Item two</text:p></text:list-item></text:list>
      <table:table><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row>
      <table:table-row><table:table-cell><text:p>1</text:p></table:table-cell><table:table-cell><text:p>2</text:p></table:table-cell></table:table-row></table:table>
      </office:text></office:body></office:document-content>`
    const zip = new JSZip()
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })
    zip.file('content.xml', xml)
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    expect(await odtToText(bytes)).toBe('# Title\n\nHello there styled.\n\n- Item one\n\n- Item two\n\n| A | B |\n| 1 | 2 |')
  })
  it('rejects a zip without content.xml', async () => {
    const zip = new JSZip()
    zip.file('a.txt', 'x')
    await expect(odtToText(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/content\.xml/)
  })
})
