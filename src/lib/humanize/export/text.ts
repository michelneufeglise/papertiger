// Plain-text writer: headings underlined, lists marked, tables as tab-separated rows.
import type { ViewItem } from '../render'

export function buildText(title: string, items: ViewItem[]): string {
  const out: string[] = []
  const under = (t: string, ch: string) => `${t}\n${ch.repeat(Math.max(3, [...t.split('\n')[0]].length))}`
  if (title.trim()) out.push(under(title.trim(), '='))
  let num = 0
  let prev: ViewItem | null = null
  for (const it of items) {
    if (it.type === 'heading') out.push(under(it.text, it.level === 1 ? '=' : it.level === 2 ? '-' : '~'))
    else if (it.type === 'para') out.push(it.text)
    else if (it.type === 'list') {
      if (it.ordered) num = prev && prev.type === 'list' && prev.ordered ? num + 1 : 1
      const line = `${it.ordered ? `${num}.` : '-'} ${it.text}`
      // Consecutive list items stay tight.
      if (prev && prev.type === 'list' && out.length) out[out.length - 1] += '\n' + line
      else out.push(line)
    } else {
      out.push(
        it.rows
          .filter((r) => r.length > 0)
          .map((r) => r.map((c) => c.text.replace(/\s*\n\s*/g, ' ')).join('\t'))
          .join('\n'),
      )
    }
    prev = it
  }
  return out.join('\n\n') + '\n'
}
