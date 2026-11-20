// OpenDocument text (.odt): content.xml from the zip, walked into light markdown.
import JSZip from 'jszip'

function clean(s: string): string {
  return s.replace(/[\s ]+/g, ' ').trim()
}

/** Inline text of a text:p / text:h, honouring text:s, text:tab and text:line-break. */
function inline(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (node.nodeType !== 1) return ''
  const el = node as Element
  switch (el.nodeName) {
    case 'text:s': {
      const n = parseInt(el.getAttribute('text:c') ?? '1', 10)
      return ' '.repeat(Number.isFinite(n) ? n : 1)
    }
    case 'text:tab':
      return ' '
    case 'text:line-break':
      return ' '
    case 'text:note':
    case 'office:annotation':
      return ''
    default: {
      let out = ''
      for (const c of Array.from(el.childNodes)) out += inline(c)
      return out
    }
  }
}

/** text:p / text:h descendants, in document order (avoids namespace-escaped CSS selectors). */
function paragraphsIn(node: Node, acc: Element[] = []): Element[] {
  for (const c of Array.from(node.childNodes)) {
    if (c.nodeType !== 1) continue
    const el = c as Element
    if (el.nodeName === 'text:p' || el.nodeName === 'text:h') acc.push(el)
    else paragraphsIn(el, acc)
  }
  return acc
}

export function odtXmlToMarkdown(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const out: string[] = []

  const walk = (node: Node, listDepth: number): void => {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType !== 1) continue
      const el = c as Element
      switch (el.nodeName) {
        case 'text:h': {
          const t = clean(inline(el))
          const level = Math.min(6, Math.max(1, parseInt(el.getAttribute('text:outline-level') ?? '1', 10) || 1))
          if (t) out.push(`${'#'.repeat(level)} ${t}`)
          break
        }
        case 'text:p': {
          const t = clean(inline(el))
          if (t) out.push(listDepth > 0 ? `- ${t}` : t)
          break
        }
        case 'table:table': {
          const rows: string[] = []
          const collect = (n: Node) => {
            for (const r of Array.from(n.childNodes)) {
              if (r.nodeType !== 1) continue
              const re = r as Element
              if (re.nodeName === 'table:table-row') {
                const cells: string[] = []
                for (const cell of Array.from(re.childNodes)) {
                  if (cell.nodeType !== 1) continue
                  const ce = cell as Element
                  if (ce.nodeName !== 'table:table-cell' && ce.nodeName !== 'table:covered-table-cell') continue
                  const repeat = Math.min(20, parseInt(ce.getAttribute('table:number-columns-repeated') ?? '1', 10) || 1)
                  const text = clean(
                    paragraphsIn(ce)
                      .map(p => inline(p))
                      .join(' '),
                  ).replace(/\|/g, '/')
                  for (let k = 0; k < repeat; k++) cells.push(text)
                }
                while (cells.length > 1 && cells[cells.length - 1] === '') cells.pop()
                if (cells.some(Boolean)) rows.push('| ' + cells.join(' | ') + ' |')
              } else if (/^table:table-(header-rows|rows|row-group)$/.test(re.nodeName)) collect(re)
            }
          }
          collect(el)
          if (rows.length) out.push(rows.join('\n'))
          break
        }
        case 'text:list':
        case 'text:list-item':
        case 'text:list-header':
          walk(el, listDepth + (el.nodeName === 'text:list' ? 1 : 0))
          break
        case 'text:note':
        case 'office:annotation':
          break
        default:
          walk(el, listDepth)
      }
    }
  }

  const body = doc.getElementsByTagName('office:text')[0] ?? doc.documentElement
  walk(body, 0)
  return out.join('\n\n')
}

export async function odtToText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const file = zip.file('content.xml')
  if (!file) throw new Error('This is not an OpenDocument text file (content.xml is missing).')
  return odtXmlToMarkdown(await file.async('string'))
}
