// Standalone HTML page (also the source for textutil -> .doc).
import type { ViewItem } from '../render'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const nl = (s: string) => escapeHtml(s).replace(/\n/g, '<br>')

export function buildHtml(title: string, items: ViewItem[]): string {
  const body: string[] = []
  if (title.trim()) body.push(`<h1>${nl(title.trim())}</h1>`)
  let open: 'ul' | 'ol' | null = null
  const close = () => {
    if (open) body.push(`</${open}>`)
    open = null
  }
  for (const it of items) {
    if (it.type === 'list') {
      const tag = it.ordered ? 'ol' : 'ul'
      if (open !== tag) {
        close()
        body.push(`<${tag}>`)
        open = tag
      }
      body.push(`<li>${nl(it.text)}</li>`)
      continue
    }
    close()
    if (it.type === 'heading') body.push(`<h${it.level + 1}>${nl(it.text)}</h${it.level + 1}>`)
    else if (it.type === 'para') body.push(`<p>${nl(it.text)}</p>`)
    else {
      const rows = it.rows.filter((r) => r.length > 0)
      const ncols = Math.max(0, ...rows.map((r) => r.length))
      if (ncols > 0) {
        body.push('<table>')
        rows.forEach((r, ri) => {
          const tag = ri === 0 ? 'th' : 'td'
          body.push(
            '<tr>' + Array.from({ length: ncols }, (_, ci) => `<${tag}>${nl(r[ci]?.text ?? '')}</${tag}>`).join('') + '</tr>',
          )
        })
        body.push('</table>')
      }
    }
  }
  close()
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title.trim() || 'Document')}</title>
<style>
body{max-width:42rem;margin:3rem auto;padding:0 1.25rem;font:17px/1.6 Georgia,'Times New Roman',serif;color:#2b2724;background:#fdfaf3}
h1,h2,h3,h4,h5{line-height:1.25;margin:1.6em 0 .5em}
table{border-collapse:collapse;margin:1em 0}th,td{border:1px solid #9a9187;padding:.3em .6em;text-align:left}th{background:#efe8d8}
</style></head><body>
${body.join('\n')}
</body></html>
`
}
