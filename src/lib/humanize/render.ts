// Port of persephone/server/humanize.py render_block / Emitter / render_markdown,
// plus a structural view of the blocks for the screen and the Word export.
import type { Block } from './segment'

function cellMd(s: string): string {
  return (s ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()
}

export function renderBlock(b: Block, text: string): string {
  if (b.kind === 'heading') return `${'#'.repeat(Math.max(1, Math.min(b.level || 2, 4)))} ${text}`
  if (b.kind === 'list') return `${b.marker || '- '}${text}`
  return text
}

/** Turns (block, final text) pairs, fed in document order, into markdown pieces. */
export class Emitter {
  started = false
  table: number | null = null
  row: number | null = null
  cells = new Map<number, string[]>()
  rowsDone = 0
  headerCols = 0

  private sep(s: string): string {
    return this.started ? s : ''
  }

  private flushRow(): string {
    if (this.table === null || this.row === null) return ''
    let ncols = this.cells.size ? Math.max(...this.cells.keys()) + 1 : 0
    if (this.rowsDone === 0) this.headerCols = ncols
    ncols = Math.max(ncols, this.headerCols)
    const vals: string[] = []
    for (let c = 0; c < ncols; c++) vals.push((this.cells.get(c) ?? []).join(' '))
    let line = '| ' + vals.map(cellMd).join(' | ') + ' |'
    const prefix = this.rowsDone === 0 ? this.sep('\n\n') : '\n'
    if (this.rowsDone === 0) line += '\n|' + Array.from({ length: ncols }, () => ' --- ').join('|') + '|'
    this.started = true
    this.rowsDone += 1
    this.cells = new Map()
    this.row = null
    return prefix + line
  }

  private endTable(): string {
    const out = this.flushRow()
    this.table = null
    this.rowsDone = 0
    this.headerCols = 0
    return out
  }

  feed(b: Block, text: string): string {
    let out = ''
    if (b.table !== null) {
      if (b.table !== this.table) {
        out += this.endTable()
        this.table = b.table
      }
      if (b.row !== this.row && this.row !== null) out += this.flushRow()
      this.row = b.row
      const col = b.col ?? 0
      const list = this.cells.get(col)
      if (list) list.push(text)
      else this.cells.set(col, [text])
      return out
    }
    out += this.endTable()
    if (b.kind === 'empty' || !text.trim()) return out
    out += this.sep('\n\n') + renderBlock(b, text)
    this.started = true
    return out
  }

  flush(): string {
    return this.endTable()
  }
}

/** Markdown of the document in order; blocks without an output keep their original text. */
export function renderMarkdown(blocks: Block[], outputs: Record<number, string> = {}): string {
  const em = new Emitter()
  const parts = blocks.map((b) => em.feed(b, outputs[b.idx] ?? b.text))
  parts.push(em.flush())
  return parts.join('')
}

// ── Structural view (screen + docx) ──────────────────────────────────────────
export interface ViewCell {
  idx: number
  text: string
  /** True when this cell was sent to the model. */
  rewrite: boolean
}

export type ViewItem =
  | { type: 'heading'; idx: number; level: number; text: string; rewrite: false }
  | { type: 'para'; idx: number; text: string; rewrite: boolean }
  | { type: 'list'; idx: number; marker: string; ordered: boolean; text: string; rewrite: boolean }
  | { type: 'table'; idx: number; rows: ViewCell[][] }

/**
 * Document-order structure of the blocks: headings, paragraphs (captions and labels included),
 * list items and tables (rows of cells; the first row is the header). Empty blocks are dropped;
 * `text` is the output when there is one, else the original.
 */
export function toView(blocks: Block[], outputs: Record<number, string> = {}): ViewItem[] {
  const items: ViewItem[] = []
  let current: { table: number; rows: ViewCell[][]; row: number | null } | null = null
  for (const b of blocks) {
    const text = outputs[b.idx] ?? b.text
    if (b.table !== null) {
      if (!current || current.table !== b.table) {
        const rows: ViewCell[][] = []
        current = { table: b.table, rows, row: null }
        items.push({ type: 'table', idx: b.idx, rows })
      }
      if (current.row !== b.row || current.rows.length === 0) {
        current.rows.push([])
        current.row = b.row
      }
      const row = current.rows[current.rows.length - 1]
      // Python's Emitter keeps cells in column order; pad missing columns.
      const col = b.col ?? 0
      while (row.length < col) row.push({ idx: -1, text: '', rewrite: false })
      row[col] = { idx: b.idx, text, rewrite: b.rewrite }
      continue
    }
    current = null
    if (b.kind === 'empty' || !text.trim()) continue
    if (b.kind === 'heading') {
      items.push({ type: 'heading', idx: b.idx, level: Math.max(1, Math.min(b.level || 2, 4)), text, rewrite: false })
    } else if (b.kind === 'list') {
      const marker = b.marker || '- '
      items.push({ type: 'list', idx: b.idx, marker, ordered: /^\d/.test(marker), text, rewrite: b.rewrite })
    } else {
      items.push({ type: 'para', idx: b.idx, text, rewrite: b.rewrite })
    }
  }
  return items
}
