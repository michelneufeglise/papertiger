// EPUB: container.xml -> OPF -> spine order -> each XHTML chapter through html.ts.
import JSZip from 'jszip'
import { htmlToMarkdown } from './html'

function resolve(base: string, href: string): string {
  const parts = (base ? base.split('/') : []).concat(decodeURIComponent(href.split('#')[0]).split('/'))
  const out: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return out.join('/')
}

export async function epubToText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const parser = new DOMParser()

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('This is not an EPUB file (META-INF/container.xml is missing).')
  const container = parser.parseFromString(await containerFile.async('string'), 'application/xml')
  const opfPath = container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
  if (!opfPath) throw new Error('The EPUB has no package document.')
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error('The EPUB package document is missing.')
  const opf = parser.parseFromString(await opfFile.async('string'), 'application/xml')
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''

  const manifest = new Map<string, { href: string; nav: boolean }>()
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest.set(id, { href, nav: (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav') })
  }

  const chapters: string[] = []
  for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
    const entry = manifest.get(ref.getAttribute('idref') ?? '')
    if (!entry || entry.nav) continue
    if (!/\.(x?html?|xml)$/i.test(entry.href)) continue
    const file = zip.file(resolve(base, entry.href))
    if (!file) continue
    const md = htmlToMarkdown(await file.async('string'))
    if (md.trim()) chapters.push(md)
  }
  return chapters.join('\n\n')
}
