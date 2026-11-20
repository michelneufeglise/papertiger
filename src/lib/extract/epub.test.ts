// @vitest-environment happy-dom
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { epubToText } from './epub'

describe('epubToText', () => {
  it('reads chapters in spine order and skips the nav document', async () => {
    const zip = new JSZip()
    zip.file('mimetype', 'application/epub+zip')
    zip.file(
      'META-INF/container.xml',
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    )
    zip.file(
      'OEBPS/content.opf',
      `<package xmlns="http://www.idpf.org/2007/opf"><manifest>
        <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
        <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
        <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
      </manifest><spine><itemref idref="nav"/><itemref idref="c2"/><itemref idref="c1"/></spine></package>`,
    )
    zip.file('OEBPS/nav.xhtml', '<html><body><nav><li>Contents</li></nav></body></html>')
    zip.file('OEBPS/text/ch1.xhtml', '<html><body><h1>One</h1><p>First chapter.</p></body></html>')
    zip.file('OEBPS/text/ch2.xhtml', '<html><body><h1>Two</h1><p>Second chapter.</p></body></html>')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    expect(await epubToText(bytes)).toBe('# Two\n\nSecond chapter.\n\n# One\n\nFirst chapter.')
  })
})
