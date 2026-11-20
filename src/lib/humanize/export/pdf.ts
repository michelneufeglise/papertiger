// PDF writer (pdf-lib): A4, 2.5 cm margins, Times Roman, bold headings, word wrap, page breaks.
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import type { ViewItem } from '../render'

const MAP: Record<string, string> = {
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '→': '->', '←': '<-', '↔': '<->', '−': '-', '‑': '-', '‐': '-', '‒': '-',
  '×': 'x', '÷': '/', '∞': 'inf', '′': "'", '″': '"', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  '∼': '~', '·': '*', '⁄': '/', '≪': '<<', '≫': '>>', 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'μ': 'u', 'σ': 'sigma',
  'Δ': 'Delta', 'π': 'pi', 'λ': 'lambda',
}

/** Maps characters outside WinAnsi to close ASCII so the standard fonts can draw them. */
export function pdfSafe(s: string, font?: PDFFont): string {
  let out = ''
  for (const ch of s.normalize('NFC')) {
    if (ch === '\t') { out += '    '; continue }
    if (ch === '\n') { out += ch; continue }
    const m = MAP[ch]
    if (m !== undefined) { out += m; continue }
    let ok = true
    try {
      if (font) font.encodeText(ch)
      else ok = ch.charCodeAt(0) < 256 || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(ch)
    } catch {
      ok = false
    }
    if (ok) { out += ch; continue }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    let r = ''
    for (const c of base) {
      try {
        if (font) font.encodeText(c)
        r += c
      } catch {
        r += '?'
      }
    }
    out += r
  }
  return out
}

const MM = 72 / 25.4
const PAGE_W = 210 * MM
const PAGE_H = 297 * MM
const MARGIN = 25 * MM

export async function buildPdf(title: string, items: ViewItem[]): Promise<Blob> {
  const doc = await PDFDocument.create()
  if (title.trim()) doc.setTitle(pdfSafe(title.trim()))
  const body = await doc.embedFont(StandardFonts.TimesRoman)
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const maxW = PAGE_W - 2 * MARGIN

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }

  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const lines: string[] = []
    for (const para of pdfSafe(text, font).split('\n')) {
      let cur = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const trial = cur ? `${cur} ${word}` : word
        if (font.widthOfTextAtSize(trial, size) <= width) { cur = trial; continue }
        if (cur) lines.push(cur)
        let w = word
        // A single word wider than the line is split by characters.
        while (font.widthOfTextAtSize(w, size) > width) {
          let n = w.length
          while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--
          lines.push(w.slice(0, n))
          w = w.slice(n)
        }
        cur = w
      }
      lines.push(cur)
    }
    return lines
  }

  const block = (text: string, font: PDFFont, size: number, opts: { before?: number; after?: number; indent?: number; label?: string } = {}) => {
    const indent = opts.indent ?? 0
    const lh = size * 1.35
    const lines = wrap(text, font, size, maxW - indent)
    y -= opts.before ?? 0
    if (y - lh < MARGIN) newPage()
    lines.forEach((ln, i) => {
      if (y - lh < MARGIN) newPage()
      y -= lh
      if (i === 0 && opts.label) page.drawText(pdfSafe(opts.label, font), { x: MARGIN + indent - 16, y, size, font })
      if (ln) page.drawText(ln, { x: MARGIN + indent, y, size, font })
    })
    y -= opts.after ?? 0
  }

  if (title.trim()) block(title.trim(), bold, 20, { after: 12 })
  let num = 0
  let prev: ViewItem | null = null
  for (const it of items) {
    if (it.type === 'heading') block(it.text, bold, [18, 15, 13, 12][it.level - 1] ?? 12, { before: 10, after: 5 })
    else if (it.type === 'para') block(it.text, body, 11, { after: 7 })
    else if (it.type === 'list') {
      if (it.ordered) num = prev && prev.type === 'list' && prev.ordered ? num + 1 : 1
      block(it.text, body, 11, { indent: 24, after: 3, label: it.ordered ? `${num}.` : '-' })
    } else {
      const rows = it.rows.filter((r) => r.length > 0)
      rows.forEach((r, ri) => {
        block(r.map((c) => c.text.replace(/\s*\n\s*/g, ' ')).join('  |  '), ri === 0 ? bold : body, 10.5, { after: 2 })
      })
      y -= 6
    }
    prev = it
  }
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
