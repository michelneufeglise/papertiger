// Port of persephone/server/humanize.py: Block, classify, segment_text and contexts.
// JS `\w` is ASCII-only, so Python's unicode `\w` is spelled out as W below.

export type BlockKind = 'heading' | 'para' | 'list' | 'cell' | 'caption' | 'label' | 'empty'

export interface Block {
  idx: number
  kind: BlockKind
  /** Original text (stripped). */
  text: string
  rewrite: boolean
  /** Why a block is protected. */
  reason: string
  /** Verbatim lead kept before the rewritten part (Q&A question / "Label:"). */
  prefix: string
  /** Whitespace between prefix and body. */
  sep: string
  /** Heading level. */
  level: number
  /** List marker for rendering ("- ", "1. "). */
  marker: string
  table: number | null
  row: number | null
  col: number | null
}

export function makeBlock(init: Partial<Block> & { kind: BlockKind; text: string }): Block {
  return {
    idx: 0,
    rewrite: false,
    reason: '',
    prefix: '',
    sep: '',
    level: 0,
    marker: '',
    table: null,
    row: null,
    col: null,
    ...init,
  }
}

export const CONTEXT_CHARS = 600
export const PROTECT_MAX_WORDS = 4
export const CAPTION_MAX_WORDS = 12

/** Python's unicode `\w` (letters, digits, marks, underscore), for use inside a `u`-flag character class. */
export const W = '\\p{L}\\p{N}\\p{M}_'

const WORD_RE = new RegExp(`[${W}À-ÖØ-öø-ÿ’'-]+`, 'gu')

export function words(s: string): string[] {
  return (s ?? '').match(WORD_RE) ?? []
}

/** Python's `block.body`. */
export function blockBody(b: Block): string {
  return b.prefix ? b.text.slice(b.prefix.length + b.sep.length) : b.text
}

const HTML_TABLE_RE = /^<table/i
const TERMINAL = '.!?:;…'
const YEAR_RE = /\b(1[0-9]{3}|20[0-9]{2})\b|\bca\.\s/
const QUESTION_LEAD_RE = /^([^\n?.!]{3,250}\?)(\s+)(?=\S)/
const LABEL_LEAD_RE = /^([A-ZÀ-Þ][^\n.:?!]{1,40}:)(\s+)(?=\S)/

/** ('Question?', ' ') when a paragraph is 'Question? Answer…' or 'Label: text…'. */
export function splitLead(text: string): [string, string] {
  let m = QUESTION_LEAD_RE.exec(text)
  if (m && words(text.slice(m[0].length)).length >= 3) return [m[1], m[2]]
  m = LABEL_LEAD_RE.exec(text)
  if (m && words(m[1]).length <= 5 && words(text.slice(m[0].length)).length >= 3) return [m[1], m[2]]
  return ['', '']
}

/** Decide whether a block is rewritten. Mutates and returns it. */
export function classify(block: Block, opts: { headerRow?: boolean } = {}): Block {
  const headerRow = opts.headerRow ?? false
  const t = block.text.trim()
  block.rewrite = false
  if (!t) {
    block.kind = 'empty'
    block.reason = 'empty'
    return block
  }
  if (block.kind === 'heading') {
    block.reason = 'heading'
    return block
  }
  if (HTML_TABLE_RE.test(t)) {
    block.kind = 'label'
    block.reason = 'html table'
    return block
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(t)) {
    block.reason = 'numbers'
    return block
  }
  if (block.table !== null && headerRow) {
    block.reason = 'table header'
    return block
  }
  if (block.kind === 'caption') {
    block.reason = 'caption'
    return block
  }
  if (!block.prefix) {
    const [p, s] = splitLead(t)
    if (p) {
      block.prefix = p
      block.sep = s
    }
  }
  const body = blockBody(block).trim()
  const n = words(body).length
  if (n <= PROTECT_MAX_WORDS) {
    block.reason = !block.prefix ? 'short label' : 'short answer'
    if (block.kind !== 'cell' && block.kind !== 'list') block.kind = 'label'
    return block
  }
  const last = body.slice(-1)
  if (!TERMINAL.includes(last) && !'”"’\')»'.includes(last) && n <= CAPTION_MAX_WORDS) {
    block.reason = 'caption/label'
    if (block.kind !== 'cell' && block.kind !== 'list') block.kind = YEAR_RE.test(body) ? 'caption' : 'label'
    return block
  }
  if (!block.prefix && body.endsWith('?') && n <= 25) {
    block.reason = 'question'
    return block
  }
  block.rewrite = true
  block.reason = ''
  return block
}

export function classifyAll(blocks: Block[]): Block[] {
  const firstRow = new Map<number, number>()
  for (const b of blocks) {
    if (b.table !== null && b.row !== null && !firstRow.has(b.table)) firstRow.set(b.table, b.row)
  }
  blocks.forEach((b, i) => {
    b.idx = i
    classify(b, { headerRow: b.table !== null && b.row === firstRow.get(b.table) })
  })
  return blocks
}

// ── Segmentation: plain / markdown text ──────────────────────────────────────
const BULLET_ONLY = new Set(['•', '◦', '▪', '‣', '●', '○', '-', '–', '*'])
const LIST_RE = /^(?:([-*•◦▪‣●○–])|(\d{1,3}[.)]))\s+/

export function joinLines(lines: string[], trailingSpaces = false): string {
  let out = ''
  lines.forEach((ln, i) => {
    if (i === 0) {
      out = ln
      return
    }
    if (!ln.trim()) return
    if (out.endsWith('-') && !out.endsWith(' -') && /^\p{Ll}/u.test(ln)) {
      out = out.slice(0, -1) + ln
    } else if (out.endsWith(' ') || out.endsWith(' ') || out.endsWith('\t')) {
      out = out + ln
    } else if (trailingSpaces) {
      out = out + ln
    } else {
      out = out + ' ' + ln
    }
  })
  return out.replace(/[ \t ]+/g, ' ').trim()
}

/**
 * OCR tables (`blocksToText`) arrive as consecutive `a | b | c` lines without outer pipes.
 * Two or more consecutive lines containing ` | ` with the same column count become `| a | b | c |`
 * rows, so the pipe-table path below handles them (the first row is the header).
 */
export function normalizeBareTables(lines: string[]): string[] {
  const cols = lines.map((raw) => {
    const s = raw.trim()
    if (!s || (s.startsWith('|') && s.endsWith('|'))) return 0
    return s.includes(' | ') ? s.split(' | ').length : 0
  })
  const out = [...lines]
  let i = 0
  while (i < lines.length) {
    if (cols[i] === 0) {
      i++
      continue
    }
    let j = i
    while (j + 1 < lines.length && cols[j + 1] === cols[i]) j++
    if (j > i) {
      for (let k = i; k <= j; k++) out[k] = '|' + lines[k].trim().split(' | ').join('|') + '|'
    }
    i = j + 1
  }
  return out
}

/** Rows of cells from an HTML table (`<tr>` with `<td>`/`<th>`), tags stripped and whitespace collapsed; null without row structure. */
export function parseHtmlTable(html: string): string[][] | null {
  const rows: string[][] = []
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length) rows.push(cells)
  }
  return rows.length ? rows : null
}

export function blocksFromLines(lines: string[], opts: { trailingSpaces?: boolean } = {}): Block[] {
  const trailingSpaces = opts.trailingSpaces ?? false
  const blocks: Block[] = []
  let buf: string[] = []
  let curKind: BlockKind = 'para'
  let curMarker = ''
  let tableRows: string[][] = []
  let tcounter = 0

  const flush = () => {
    if (buf.length) {
      const t = joinLines(buf, trailingSpaces)
      const html = HTML_TABLE_RE.test(t) ? parseHtmlTable(t) : null
      if (html) {
        flushRows(html)
      } else if (t) blocks.push(makeBlock({ kind: curKind, text: t, marker: curMarker }))
    }
    buf = []
    curKind = 'para'
    curMarker = ''
  }
  const flushRows = (rows: string[][]) => {
    const ti = tcounter++
    rows.forEach((cells, ri) => {
      cells.forEach((c, ci) => {
        blocks.push(makeBlock({ kind: 'cell', text: c.trim(), table: ti, row: ri, col: ci }))
      })
    })
  }
  const flushTable = () => {
    if (tableRows.length) {
      const ti = tcounter++
      tableRows.forEach((cells, ri) => {
        cells.forEach((c, ci) => {
          blocks.push(makeBlock({ kind: 'cell', text: c.trim(), table: ti, row: ri, col: ci }))
        })
      })
      tableRows = []
    }
  }

  for (const line of normalizeBareTables(lines)) {
    const s = line.trim()
    if (!s) {
      flush()
      flushTable()
      continue
    }
    if (s.startsWith('|') && s.endsWith('|') && s.length > 1) {
      flush()
      const inner = s.slice(1, -1)
      if (/^[\s|:-]+$/.test(inner)) continue
      tableRows.push(inner.split('|'))
      continue
    }
    flushTable()
    const mh = /^(#{1,6})\s+(.*)$/.exec(s)
    if (mh) {
      flush()
      blocks.push(makeBlock({ kind: 'heading', text: mh[2].trim(), level: mh[1].length }))
      continue
    }
    if (BULLET_ONLY.has(s)) {
      flush()
      curKind = 'list'
      curMarker = '- '
      continue
    }
    const ml = LIST_RE.exec(s)
    if (ml) {
      flush()
      curKind = 'list'
      curMarker = ml[2] ? ml[2] + ' ' : '- '
      const rest = line.trimStart().slice(ml[0].length)
      buf = rest.trim() ? [rest] : []
      continue
    }
    buf.push(trailingSpaces ? line : s)
  }
  flush()
  flushTable()
  return blocks
}

function looksLikeHeading(t: string): boolean {
  const n = words(t).length
  return n > 0 && n <= CAPTION_MAX_WORDS && !TERMINAL.includes(t.slice(-1)) && !t.includes('\n')
}

/** Unclassified blocks, as Persephone's `segment_text`. Call `classifyAll` (or use `segmentText`). */
export function segmentTextRaw(text: string): Block[] {
  // oxlint-disable-next-line no-control-regex
  const blocks = blocksFromLines((text ?? '').split(/\r\n|[\n\r\v\f\u001c-\u001e\u0085\u2028\u2029]/))
  for (const b of blocks) {
    if (b.kind === 'para' && !b.text.includes('\n') && looksLikeHeading(b.text)) {
      b.kind = YEAR_RE.test(b.text) ? 'caption' : 'label'
    }
  }
  return blocks
}

/** Segment plain / markdown / OCR text into blocks and classify them (`segment_text` + `_classify_all`). */
export function segmentText(text: string): Block[] {
  return classifyAll(segmentTextRaw(text))
}

// ── Contexts ─────────────────────────────────────────────────────────────────
export interface BlockContext {
  title: string
  section: string
  prev: string
  next: string
  column: string | null
}

/** prev/next text, current section heading and table column header per block. */
export function contexts(blocks: Block[], title: string): Map<number, BlockContext> {
  const ctx = new Map<number, BlockContext>()
  let section = ''
  const headers = new Map<string, string>()
  const firstRow = new Map<number, number>()
  for (const b of blocks) {
    if (b.table !== null) {
      if (!firstRow.has(b.table)) firstRow.set(b.table, b.row ?? 0)
      if (b.row === firstRow.get(b.table)) headers.set(`${b.table}:${b.col ?? 0}`, b.text)
    }
  }
  const texts = blocks.filter((b) => b.kind !== 'empty')
  const pos = new Map<number, number>()
  texts.forEach((b, i) => pos.set(b.idx, i))
  for (const b of blocks) {
    if (b.kind === 'heading') section = b.text
    const i = pos.get(b.idx)
    const prev = i !== undefined && i > 0 ? texts[i - 1].text : ''
    const next = i !== undefined && i + 1 < texts.length ? texts[i + 1].text : ''
    ctx.set(b.idx, {
      title,
      section: section !== b.text ? section : '',
      prev,
      next,
      column: b.table !== null ? (headers.get(`${b.table}:${b.col ?? 0}`) ?? null) : null,
    })
  }
  return ctx
}
