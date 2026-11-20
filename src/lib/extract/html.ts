// HTML to the light markdown the Humanize segmenter understands:
// `#` headings, blank-line separated paragraphs, `- ` list items, `| a | b |` table rows.

const SKIP = new Set(['script', 'style', 'head', 'noscript', 'template', 'svg', 'title'])
const HEADING_RE = /^h([1-6])$/
const BLOCKS = new Set([
  'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'blockquote',
  'ul', 'ol', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'address', 'form', 'fieldset', 'details', 'summary', 'hr',
])

function clean(s: string): string {
  return s.replace(/[\s ]+/g, ' ').trim()
}

/** Collapsed text of an element, skipping scripts and styles (used for table cells). */
function plainText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (node.nodeType !== 1) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (SKIP.has(tag)) return ''
  if (tag === 'br') return ' '
  let out = ''
  for (const c of Array.from(el.childNodes)) out += plainText(c)
  return BLOCKS.has(tag) || tag === 'li' || tag === 'tr' ? ` ${out} ` : out
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  let buf = ''
  let prefix = ''
  let lastBr = false

  const flush = () => {
    const t = clean(buf)
    buf = ''
    if (!t) return
    out.push(prefix + t)
    prefix = ''
  }

  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      buf += node.textContent ?? ''
      lastBr = false
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (SKIP.has(tag)) return

    const hm = HEADING_RE.exec(tag)
    if (hm) {
      flush()
      const t = clean(plainText(el))
      if (t) out.push(`${'#'.repeat(Number(hm[1]))} ${t}`)
      return
    }
    if (tag === 'br') {
      if (lastBr) flush()
      else buf += ' '
      lastBr = true
      return
    }
    if (tag === 'table') {
      flush()
      const rows: string[] = []
      for (const tr of Array.from(el.querySelectorAll('tr'))) {
        // Skip rows of nested tables; the nested table's own pass handles them.
        const cells = Array.from(tr.children).filter(c => /^t[dh]$/i.test(c.tagName))
        if (cells.length === 0) continue
        rows.push('| ' + cells.map(c => clean(plainText(c)).replace(/\|/g, '/')).join(' | ') + ' |')
      }
      if (rows.length) out.push(rows.join('\n'))
      return
    }
    if (tag === 'pre') {
      flush()
      const t = (el.textContent ?? '').replace(/\s+$/, '').replace(/^\n+/, '')
      if (t.trim()) out.push(t)
      return
    }
    if (tag === 'li') {
      flush()
      prefix = '- '
      for (const c of Array.from(el.childNodes)) walk(c)
      flush()
      prefix = ''
      return
    }
    const block = BLOCKS.has(tag)
    if (block) flush()
    for (const c of Array.from(el.childNodes)) walk(c)
    if (block) flush()
    lastBr = false
  }

  walk(doc.body ?? doc.documentElement)
  flush()
  return out.join('\n\n')
}
