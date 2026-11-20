// RTF writer: headings bold and larger, paragraphs, lists and tables; non-ASCII as \uN?.
import type { ViewItem } from '../render'

export function rtfEscape(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch
    else if (ch === '\n') out += '\\line '
    else if (c < 32) out += ''
    else if (c < 128) out += ch
    else if (c > 0xffff) {
      const v = c - 0x10000
      for (const u of [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)]) out += `\\u${u > 32767 ? u - 65536 : u}\\'3f`
    } else out += `\\u${c > 32767 ? c - 65536 : c}\\'3f`
  }
  return out
}

const SIZES = [36, 32, 28, 26]

export function buildRtf(title: string, items: ViewItem[]): string {
  const parts: string[] = ['{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}}\\f0\\fs24\n']
  if (title.trim()) parts.push(`\\pard\\sa240\\b\\fs40 ${rtfEscape(title.trim())}\\b0\\fs24\\par\n`)
  let num = 0
  let prev: ViewItem | null = null
  for (const it of items) {
    if (it.type === 'heading') {
      parts.push(`\\pard\\sb240\\sa120\\b\\fs${SIZES[it.level - 1] ?? 26} ${rtfEscape(it.text)}\\b0\\fs24\\par\n`)
    } else if (it.type === 'para') {
      parts.push(`\\pard\\sa160 ${rtfEscape(it.text)}\\par\n`)
    } else if (it.type === 'list') {
      if (it.ordered) num = prev && prev.type === 'list' && prev.ordered ? num + 1 : 1
      const lead = it.ordered ? `${num}.\\tab ` : '\\u8226\\\'3f\\tab '
      parts.push(`\\pard\\fi-360\\li720\\sa80 ${lead}${rtfEscape(it.text)}\\par\n`)
    } else {
      const rows = it.rows.filter((r) => r.length > 0)
      const ncols = Math.max(0, ...rows.map((r) => r.length))
      if (ncols > 0) {
        const w = Math.floor(9000 / ncols)
        const defs = Array.from({ length: ncols }, (_, i) => `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${w * (i + 1)}`).join('')
        rows.forEach((r, ri) => {
          const cells = Array.from({ length: ncols }, (_, ci) => {
            const t = rtfEscape(r[ci]?.text ?? '')
            return `\\pard\\intbl ${ri === 0 ? `\\b ${t}\\b0` : t}\\cell`
          }).join('')
          parts.push(`\\trowd\\trgaph80${defs}${cells}\\row\n`)
        })
        parts.push('\\pard\\par\n')
      }
    }
    prev = it
  }
  parts.push('}')
  return parts.join('')
}
