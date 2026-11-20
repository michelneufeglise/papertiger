// Text-layer extraction for digital PDFs: one pdf.js page -> light markdown
// (`#` headings, blank-line paragraphs, `- ` / `1. ` items, `| a | b |` table rows).
// The layout core (`layoutToMarkdown`) is a pure function over text items so tests can feed
// synthetic data; `pageToMarkdown` is the thin pdf.js wrapper.
import type { PDFPageProxy } from 'pdfjs-dist'

export interface RawTextItem {
  str: string
  /** [a, b, c, d, x, y] in PDF user space (y grows upward). */
  transform: number[]
  width: number
  height?: number
  fontName?: string
}

export interface PageLayout {
  /** pdf.js `getTextContent().items`; marked-content entries (no `str`) are ignored. */
  items: ReadonlyArray<RawTextItem | { type?: string }>
  styles?: Record<string, { fontFamily?: string }>
  /** Viewport height at scale 1. */
  height: number
  /** Bottom edge of the page box in PDF space (`page.view[1]`), 0 for most files. */
  originY?: number
}

export type PageVerdict = 'text' | 'empty' | 'garbled'

export interface PageStats {
  chars: number
  letterRatio: number
  badRatio: number
  meanWordLength: number
  lines: number
  columns: boolean
  bodySize: number
}

/** A header/footer candidate line: it sits in the top or bottom 8% of the page. */
export interface EdgeLine {
  /** Normalised text (lower-case, digits folded) used to spot repeats across pages. */
  key: string
  /** The paragraph exactly as written into `text`, so it can be removed again. */
  md: string
  zone: 'top' | 'bottom'
  /** A lone page number ("3", "Page 3 of 10", "- 3 -"). */
  pageNumber: boolean
}

export interface PageMarkdown {
  text: string
  verdict: PageVerdict
  stats: PageStats
  edgeLines: EdgeLine[]
}

// ── geometry ─────────────────────────────────────────────────────────────────
interface Frag {
  x: number
  xEnd: number
  y: number
  size: number
  bold: boolean
  text: string
}

interface Seg {
  x: number
  xEnd: number
  text: string
}

type Col = 'S' | 'L' | 'R' | 'X'

interface Line {
  y: number
  x: number
  xEnd: number
  size: number
  bold: boolean
  text: string
  segs: Seg[]
  col: Col
  /** Reading-order key in column mode. */
  band: number
  zone: 'top' | 'bottom' | null
}

const BOLD_RE = /Bold|Black|Heavy|Semibold/i
const BULLET_RE = /^([•◦▪‣●○])\s*(\S.*)$/u
const DASH_BULLET_RE = /^([-–*])\s+(\S.*)$/u
const NUMBER_RE = /^(\d{1,3})[.)]\s+(\S.*)$/u
const PAGE_NUMBER_RE = /^[-–\s]*(?:page\s+)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?[-–\s]*$/i

const EDGE_FRACTION = 0.08
const HEADING_RATIO = 1.15
const GAP_SPACE = 0.2
const GAP_SEGMENT = 1.5

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function toFrags(input: PageLayout): Frag[] {
  const frags: Frag[] = []
  for (const raw of input.items) {
    if (!('str' in raw) || typeof raw.str !== 'string' || !raw.str.trim()) continue
    const t = raw.transform
    const size = Math.abs(t[3]) || Math.abs(raw.height ?? 0) || 10
    const width = raw.width > 0 ? raw.width : raw.str.length * size * 0.5
    const family = raw.fontName ? (input.styles?.[raw.fontName]?.fontFamily ?? '') : ''
    frags.push({
      x: t[4],
      xEnd: t[4] + width,
      y: t[5],
      size,
      bold: BOLD_RE.test(raw.fontName ?? '') || BOLD_RE.test(family),
      text: raw.str,
    })
  }
  return frags
}

/** Group fragments into baseline lines (top first), segments split at gaps over 1.5x the font size. */
function groupLines(frags: Frag[], col: Col): Line[] {
  const sorted = [...frags].sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: Frag[][] = []
  for (const f of sorted) {
    const last = groups[groups.length - 1]
    if (last && Math.abs(last[0].y - f.y) <= 0.5 * Math.max(last[0].size, f.size)) last.push(f)
    else groups.push([f])
  }

  return groups.map(group => {
    group.sort((a, b) => a.x - b.x)
    const segs: Seg[] = []
    let seg: Seg | null = null
    let prev: Frag | null = null
    for (const f of group) {
      const gap = prev ? f.x - prev.xEnd : 0
      const size = prev ? Math.max(prev.size, f.size) : f.size
      if (!seg || gap > GAP_SEGMENT * size) {
        seg = { x: f.x, xEnd: f.xEnd, text: f.text }
        segs.push(seg)
      } else {
        const needsSpace = gap > GAP_SPACE * size && !/\s$/.test(seg.text) && !/^\s/.test(f.text)
        seg.text += (needsSpace ? ' ' : '') + f.text
        seg.xEnd = Math.max(seg.xEnd, f.xEnd)
      }
      prev = f
    }
    for (const s of segs) s.text = s.text.replace(/\s+/g, ' ').trim()

    const bySize = new Map<number, number>()
    let boldChars = 0
    let chars = 0
    let dominant = group[0]
    for (const f of group) {
      const n = f.text.trim().length
      chars += n
      if (f.bold) boldChars += n
      if (n > (dominant.text.trim().length || 0)) dominant = f
      bySize.set(f.size, (bySize.get(f.size) ?? 0) + n)
    }
    return {
      y: dominant.y,
      x: group[0].x,
      xEnd: Math.max(...group.map(f => f.xEnd)),
      size: dominant.size,
      bold: chars > 0 && boldChars / chars > 0.5,
      text: segs.map(s => s.text).filter(Boolean).join(' '),
      segs: segs.filter(s => s.text),
      col,
      band: 0,
      zone: null,
    }
  })
}

function addWeights(weights: Map<number, number>, frags: Frag[]): void {
  for (const f of frags) {
    const k = Math.round(f.size * 2) / 2
    weights.set(k, (weights.get(k) ?? 0) + f.text.trim().length)
  }
}

/** Document-wide font sizes, so heading levels agree on every page. */
export interface FontProfile {
  bodySize: number
  /** Distinct heading sizes (at least 1.15x the body size), largest first. */
  headingSizes: number[]
}

function profileFromWeights(weights: Map<number, number>): FontProfile {
  const bodySize = bodyFromWeights(weights)
  const headingSizes = [...weights.keys()].filter(k => k >= HEADING_RATIO * bodySize).sort((a, b) => b - a)
  return { bodySize, headingSizes }
}

/** Pure version of the first pass: font profile over several pages' layouts. */
export function fontProfileOf(layouts: PageLayout[]): FontProfile {
  const weights = new Map<number, number>()
  for (const l of layouts) addWeights(weights, toFrags(l))
  return profileFromWeights(weights)
}

/** First pass over a pdf.js document: text items of every page, sizes only (nothing is kept). */
export async function fontProfileOfDocument(doc: {
  numPages: number
  getPage(n: number): Promise<PDFPageProxy>
}): Promise<FontProfile> {
  const weights = new Map<number, number>()
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    addWeights(weights, toFrags({ items: content.items as PageLayout['items'], styles: content.styles as PageLayout['styles'], height: 0 }))
    page.cleanup()
  }
  return profileFromWeights(weights)
}

/** Body font size: the most common size weighted by characters, rounded to 0.5. */
function bodySizeOf(frags: Frag[]): number {
  const weights = new Map<number, number>()
  addWeights(weights, frags)
  return bodyFromWeights(weights)
}

function bodyFromWeights(weights: Map<number, number>): number {
  let best = 10
  let bestW = -1
  for (const [k, w] of weights) {
    if (w > bestW) {
      best = k
      bestW = w
    }
  }
  return best
}

// ── columns ──────────────────────────────────────────────────────────────────
/** x of a vertical gutter when the page reads as two text columns, else null. */
function findGutter(frags: Frag[], body: number): number | null {
  if (frags.length < 16) return null
  const total = frags.reduce((n, f) => n + f.text.trim().length, 0)
  const minX = Math.min(...frags.map(f => f.x))
  const maxX = Math.max(...frags.map(f => f.xEnd))
  const band = body // half-width: the clear band is about 2x the font size wide
  const bucket = (y: number) => Math.round(y / (0.6 * body))

  const valid: { g: number; cross: number }[] = []
  for (let g = minX + 4 * band; g <= maxX - 4 * band; g += 2) {
    let cross = 0
    let leftChars = 0
    let rightChars = 0
    const leftLines = new Set<number>()
    const rightLines = new Set<number>()
    for (const f of frags) {
      const n = f.text.trim().length
      if (f.xEnd > g - band && f.x < g + band) cross += n
      else if (f.xEnd <= g - band) {
        leftChars += n
        leftLines.add(bucket(f.y))
      } else {
        rightChars += n
        rightLines.add(bucket(f.y))
      }
    }
    if (cross / total > 0.3) continue
    if ((leftChars + rightChars) / total < 0.7) continue
    if (leftLines.size < 8 || rightLines.size < 8) continue
    // Column text runs long; table cells and short labels do not.
    if (leftChars / leftLines.size < 25 || rightChars / rightLines.size < 25) continue
    valid.push({ g, cross })
  }
  if (!valid.length) return null
  const minCross = Math.min(...valid.map(v => v.cross))
  const best = valid.filter(v => v.cross === minCross).map(v => v.g)
  return best[best.length >> 1]
}

/** Lines in reading order. Two columns: bands separated by full-width lines, left then right in each. */
function orderLines(frags: Frag[], gutter: number | null, body: number): Line[] {
  if (gutter === null) return groupLines(frags, 'S')

  const left: Frag[] = []
  const right: Frag[] = []
  const cross: Frag[] = []
  for (const f of frags) {
    if (f.xEnd > gutter - body && f.x < gutter + body) cross.push(f)
    else if (f.xEnd <= gutter - body) left.push(f)
    else right.push(f)
  }
  const xLines = groupLines(cross, 'X')
  const lines = [...groupLines(left, 'L'), ...groupLines(right, 'R'), ...xLines]
  const sepYs = xLines.map(l => l.y)
  for (const l of lines) {
    const above = sepYs.filter(y => y > l.y + 0.5 * l.size).length
    l.band = l.col === 'X' ? sepYs.filter(y => y > l.y + 0.5 * l.size).length : above
  }
  const colRank: Record<Col, number> = { S: 0, L: 0, R: 1, X: 2 }
  return lines.sort((a, b) => a.band - b.band || colRank[a.col] - colRank[b.col] || b.y - a.y)
}

// ── blocks ───────────────────────────────────────────────────────────────────
interface Cur {
  kind: 'p' | 'li' | 'h'
  marker: string
  level: number
  text: string
  last: Line
  x: number
  zone: 'top' | 'bottom' | null
}

function joinText(prev: string, next: string): string {
  if (prev.endsWith('-') && !prev.endsWith(' -') && /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(next)) {
    return prev.slice(0, -1) + next
  }
  return `${prev} ${next}`
}

function matchList(text: string): { marker: string; rest: string } | null {
  let m = BULLET_RE.exec(text) ?? DASH_BULLET_RE.exec(text)
  if (m) return { marker: '- ', rest: m[2] }
  m = NUMBER_RE.exec(text)
  if (m) return { marker: `${m[1]}. `, rest: m[2] }
  return null
}

/** Number of consecutive lines from `i` forming an aligned table (3+ lines, 3+ cells each), else 0. */
function tableRun(seq: Line[], i: number): number {
  const head = seq[i]
  if (head.zone || head.segs.length < 3) return 0
  let n = 1
  while (i + n < seq.length) {
    const l = seq[i + n]
    if (l.zone || l.segs.length !== head.segs.length) break
    const tol = 1.5 * Math.max(l.size, head.size)
    const aligned = l.segs.every((s, k) => {
      const h = head.segs[k]
      return Math.abs(s.x - h.x) <= tol || (s.x < h.xEnd && s.xEnd > h.x) || Math.abs(s.xEnd - h.xEnd) <= tol
    })
    if (!aligned) break
    n++
  }
  return n >= 3 ? n : 0
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
}

function qualityOf(text: string, lines: number, columns: boolean, bodySize: number): { verdict: PageVerdict; stats: PageStats } {
  const chars = [...text]
  const nonSpace = chars.filter(c => !/\s/.test(c)).length
  let good = 0
  let bad = 0
  let letters = 0
  for (const c of chars) {
    if (c === '�' || /\p{Co}/u.test(c)) bad++
    else if (/[\p{L}\p{N}\p{M}\p{P}\p{S}\s]/u.test(c)) good++
    if (/\p{L}/u.test(c)) letters++
  }
  const wordList = text.match(/[\p{L}\p{N}]+/gu) ?? []
  const meanWordLength = wordList.length ? wordList.reduce((n, w) => n + w.length, 0) / wordList.length : 0
  const stats: PageStats = {
    chars: nonSpace,
    letterRatio: nonSpace ? letters / nonSpace : 0,
    badRatio: chars.length ? bad / chars.length : 0,
    meanWordLength,
    lines,
    columns,
    bodySize,
  }
  let verdict: PageVerdict
  if (nonSpace < 40) verdict = 'empty'
  else if (good / chars.length < 0.85 || stats.badRatio >= 0.02 || meanWordLength < 2 || meanWordLength > 14) verdict = 'garbled'
  else verdict = 'text'
  return { verdict, stats }
}

/** Pure layout core: text items in, light markdown out. */
export function layoutToMarkdown(input: PageLayout, profile?: FontProfile): PageMarkdown {
  const frags = toFrags(input)
  const body = profile?.bodySize ?? bodySizeOf(frags)
  const gutter = findGutter(frags, body)
  const seq = orderLines(frags, gutter, body)

  const pageTop = (input.originY ?? 0) + input.height
  for (const l of seq) {
    const f = input.height > 0 ? (pageTop - l.y) / input.height : 0.5
    l.zone = f < EDGE_FRACTION ? 'top' : f > 1 - EDGE_FRACTION ? 'bottom' : null
  }

  // Median pitch of consecutive body-size lines in reading order (heading gaps would skew it).
  const isBody = (l: Line) => Math.abs(l.size - body) <= 0.1 * body
  const gaps: number[] = []
  for (let i = 1; i < seq.length; i++) {
    if (!isBody(seq[i - 1]) || !isBody(seq[i])) continue
    const g = seq[i - 1].y - seq[i].y
    if (g > 0 && g < 3 * body) gaps.push(g)
  }
  const pitch = median(gaps) || body * 1.2

  const headingSizes =
    profile?.headingSizes ??
    [...new Set(seq.filter(l => l.size >= HEADING_RATIO * body).map(l => Math.round(l.size * 2) / 2))].sort((a, b) => b - a)

  const out: string[] = []
  const edgeLines: EdgeLine[] = []
  let cur: Cur | null = null
  let prevKind: string | null = null

  const push = (md: string, kind: string) => {
    const sep = out.length === 0 ? '' : prevKind === 'li' && kind === 'li' ? '\n' : '\n\n'
    out.push(sep + md)
    prevKind = kind
  }
  const flush = () => {
    if (!cur) return
    const md = cur.kind === 'h' ? `${'#'.repeat(cur.level)} ${cur.text}` : cur.kind === 'li' ? cur.marker + cur.text : cur.text
    push(md, cur.kind)
    if (cur.zone) {
      edgeLines.push({
        key: normalizeKey(cur.text),
        md,
        zone: cur.zone,
        pageNumber: PAGE_NUMBER_RE.test(cur.text),
      })
    }
    cur = null
  }

  for (let i = 0; i < seq.length; i++) {
    const line = seq[i]
    if (!line.text) continue

    if (gutter === null) {
      const n = tableRun(seq, i)
      if (n) {
        flush()
        const rows = seq.slice(i, i + n).map(r => `| ${r.segs.map(s => s.text.replace(/\|/g, '/')).join(' | ')} |`)
        push(rows.join('\n'), 'table')
        i += n - 1
        continue
      }
    }

    // Heading by size rank, or an isolated bold line at body size without a closing period.
    let level = 0
    if (line.text.length < 120) {
      if (line.size >= HEADING_RATIO * body) {
        const rounded = Math.round(line.size * 2) / 2
        level = Math.min(headingSizes.filter(h => h > rounded + 0.01).length + 1, 3)
      } else if (line.bold && line.size >= 0.9 * body && !/\.$/.test(line.text)) {
        const prev = seq[i - 1]
        const next = seq[i + 1]
        const nextBold = next && next.bold && next.y < line.y && line.y - next.y <= 1.3 * pitch
        if (!(prev && prev.bold && line.y < prev.y && prev.y - line.y <= 1.3 * pitch) && !nextBold) level = 3
      }
    }
    if (level) {
      const c = cur as Cur | null
      if (c && c.kind === 'h' && c.level === level && !c.zone && Math.abs(c.last.size - line.size) < 0.1 * body && c.last.bold === line.bold && c.last.y - line.y <= 1.3 * line.size) {
        c.text = joinText(c.text, line.text)
        c.last = line
      } else {
        flush()
        cur = { kind: 'h', marker: '', level, text: line.text, last: line, x: line.x, zone: line.zone }
      }
      continue
    }

    const item = matchList(line.text)
    if (item && !line.zone) {
      flush()
      cur = { kind: 'li', marker: item.marker, level: 0, text: item.rest, last: line, x: line.x, zone: null }
      continue
    }

    const c = cur as Cur | null
    let breakHere = !c || c.kind === 'h' || !!c.zone || !!line.zone
    if (c && !breakHere) {
      const gap = c.last.y - line.y
      if (gap > 1.4 * pitch) breakHere = true
      else if (Math.abs(c.last.size - line.size) > 0.1 * body) breakHere = true
      else if (c.last.col === 'X' || line.col === 'X') breakHere = true
      else if (c.kind === 'p') {
        const dx = line.x - c.last.x
        if (dx > 0.8 * body && dx < 4 * body) breakHere = true
      } else if (line.x < c.x - 0.5 * body) breakHere = true
    }
    if (breakHere) {
      flush()
      cur = { kind: 'p', marker: '', level: 0, text: line.text, last: line, x: line.x, zone: line.zone }
    } else if (c) {
      c.text = joinText(c.text, line.text)
      c.last = line
    }
  }
  flush()

  const text = out.join('')
  const { verdict, stats } = qualityOf(seq.map(l => l.text).join('\n'), seq.length, gutter !== null, body)
  return { text, verdict, stats, edgeLines }
}

/** Read one pdf.js page into light markdown. */
export async function pageToMarkdown(page: PDFPageProxy, profile?: FontProfile): Promise<PageMarkdown> {
  const content = await page.getTextContent()
  const viewport = page.getViewport({ scale: 1 })
  const view = (page as unknown as { view?: number[] }).view
  return layoutToMarkdown({
    items: content.items as PageLayout['items'],
    styles: content.styles as PageLayout['styles'],
    height: viewport.height,
    originY: view?.[1] ?? 0,
  }, profile)
}

/**
 * Drop running headers/footers from a document's text pages: an edge line (top or bottom 8%)
 * whose digit-folded text repeats on 3+ pages, plus lone page numbers. Returns new pages.
 */
export function stripRunningLines(pages: PageMarkdown[]): PageMarkdown[] {
  const seen = new Map<string, Set<number>>()
  pages.forEach((p, i) => {
    for (const e of p.edgeLines) {
      if (!e.key) continue
      const set = seen.get(e.key) ?? new Set<number>()
      set.add(i)
      seen.set(e.key, set)
    }
  })
  const repeated = new Set([...seen].filter(([, set]) => set.size >= 3).map(([k]) => k))

  return pages.map(p => {
    const drop = p.edgeLines.filter(e => e.pageNumber || repeated.has(e.key)).map(e => e.md)
    if (!drop.length) return p
    const paragraphs = p.text.split(/\n{2,}/).filter(par => !drop.includes(par.trim()))
    return { ...p, text: paragraphs.join('\n\n'), edgeLines: p.edgeLines.filter(e => !drop.includes(e.md)) }
  })
}
