// OpenDocument text writer (jszip): mimetype first and STORED, then content, styles, manifest.
import JSZip from 'jszip'
import { escapeHtml } from './html'
import type { ViewItem } from '../render'

const MIME = 'application/vnd.oasis.opendocument.text'

const x = (s: string) =>
  escapeHtml(s)
    .replace(/&quot;/g, '&quot;')
    .replace(/\n/g, '<text:line-break/>')

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'

export function buildOdtContent(title: string, items: ViewItem[]): string {
  const b: string[] = []
  if (title.trim()) b.push(`<text:p text:style-name="Title">${x(title.trim())}</text:p>`)
  let open: 'ul' | 'ol' | null = null
  const close = () => {
    if (open) b.push('</text:list>')
    open = null
  }
  for (const it of items) {
    if (it.type === 'list') {
      const t = it.ordered ? 'ol' : 'ul'
      if (open !== t) {
        close()
        b.push(`<text:list text:style-name="${it.ordered ? 'Numbers' : 'Bullets'}">`)
        open = t
      }
      b.push(`<text:list-item><text:p text:style-name="Standard">${x(it.text)}</text:p></text:list-item>`)
      continue
    }
    close()
    if (it.type === 'heading') {
      b.push(`<text:h text:style-name="Heading_20_${it.level}" text:outline-level="${it.level}">${x(it.text)}</text:h>`)
    } else if (it.type === 'para') {
      b.push(`<text:p text:style-name="Standard">${x(it.text)}</text:p>`)
    } else {
      const rows = it.rows.filter((r) => r.length > 0)
      const ncols = Math.max(0, ...rows.map((r) => r.length))
      if (ncols > 0) {
        b.push(`<table:table table:name="Table${it.idx}"><table:table-column table:number-columns-repeated="${ncols}"/>`)
        rows.forEach((r, ri) => {
          b.push('<table:table-row>')
          for (let ci = 0; ci < ncols; ci++) {
            b.push(
              `<table:table-cell office:value-type="string"><text:p text:style-name="${ri === 0 ? 'TableHeader' : 'Standard'}">${x(r[ci]?.text ?? '')}</text:p></table:table-cell>`,
            )
          }
          b.push('</table:table-row>')
        })
        b.push('</table:table>')
      }
    }
  }
  close()
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.2"><office:body><office:text>${b.join('')}</office:text></office:body></office:document-content>`
}

const bold = 'fo:font-weight="bold"'
const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.2"><office:styles>
<style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.2cm"/><style:text-properties style:font-name="Times New Roman" fo:font-size="12pt"/></style:style>
<style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.4cm"/><style:text-properties ${bold} fo:font-size="20pt"/></style:style>
<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm"/><style:text-properties ${bold} fo:font-size="18pt"/></style:style>
<style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm"/><style:text-properties ${bold} fo:font-size="16pt"/></style:style>
<style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.2cm"/><style:text-properties ${bold} fo:font-size="14pt"/></style:style>
<style:style style:name="Heading_20_4" style:display-name="Heading 4" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.2cm"/><style:text-properties ${bold} fo:font-size="13pt"/></style:style>
<style:style style:name="TableHeader" style:family="paragraph"><style:text-properties ${bold} fo:font-size="12pt"/></style:style>
<text:list-style style:name="Bullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:margin-left="1.27cm" fo:text-indent="-0.63cm"/></style:list-level-properties></text:list-level-style-bullet></text:list-style>
<text:list-style style:name="Numbers"><text:list-level-style-number text:level="1" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:margin-left="1.27cm" fo:text-indent="-0.63cm"/></style:list-level-properties></text:list-level-style-number></text:list-style>
</office:styles></office:document-styles>`

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`

export async function buildOdt(title: string, items: ViewItem[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file('mimetype', MIME, { compression: 'STORE' })
  zip.file('content.xml', buildOdtContent(title, items))
  zip.file('styles.xml', STYLES)
  zip.file('META-INF/manifest.xml', MANIFEST)
  return zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' })
}
