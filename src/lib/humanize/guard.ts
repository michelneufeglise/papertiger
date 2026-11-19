// Port of persephone/server/humanize.py output cleaning and the per-block quality guard.
import { blockBody, W, type Block } from './segment'

const PREAMBLE_RE = new RegExp(
  '^\\s*(?:hier is|hieronder|herschreven|herschrijving|de herschreven|here is|here\'s|rewritten|sure|certainly|' +
    'natuurlijk|zeker|antwoord|answer)\\b[^\\n]{0,80}:\\s*\\n',
  'i',
)

export function cleanOutput(out: string, block?: Block | null): string {
  let s = out ?? ''
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '')
  if (s.includes('<think>')) s = s.split('<think>', 1)[0]
  s = s.trim()
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/.exec(s)
  if (fence) s = fence[1].trim()
  s = s.replace(PREAMBLE_RE, '').trim()
  s = s.replace(/<<</g, '').replace(/>>>/g, '').trim()
  if (
    s.length >= 2 &&
    s[0] === '"' &&
    s[s.length - 1] === '"' &&
    block &&
    !blockBody(block).trim().startsWith('"')
  ) {
    s = s.slice(1, -1).trim()
  }
  if (block && block.prefix && s.startsWith(block.prefix)) s = s.slice(block.prefix.length).trim()
  if (block && !blockBody(block).trim().includes('\n')) s = s.replace(/\s*\n+\s*/g, ' ')
  if (block) s = restoreQuotes(blockBody(block), s)
  return s.trim()
}

/** Put the source's quotation-mark style back when the model switched it. */
export function restoreQuotes(src: string, outIn: string): string {
  let out = outIn
  if (src.includes('“') && !src.includes('„') && out.includes('„')) {
    out = out.replace(/„([^„“”"\n]{0,300}?)[“”"]/g, '“$1”')
  }
  if (src.includes('“') && !src.includes('"') && out.includes('"')) {
    out = out.replace(/"([^"\n]{0,300}?)"/g, '“$1”')
  }
  return out
}

const QUOTE_SPAN_RE = /[“„"]([^“”„"\n]{1,120})[”“"]/g

export function quotedSpans(text: string): string[] {
  const out: string[] = []
  for (const m of (text ?? '').matchAll(QUOTE_SPAN_RE)) {
    const t = m[1].trim()
    if (t) out.push(t)
  }
  return out
}

const NW = `${W}À-ÿ`
const KEY_TERM_RE = new RegExp(`(?<![${NW}])[a-zà-öø-ÿ]{14,}(?![${NW}])`, 'gu')

/** Long lowercase content words (Dutch compounds such as 'historieschilderkunst'). */
export function keyTerms(text: string): string[] {
  const seen: string[] = []
  for (const m of (text ?? '').matchAll(KEY_TERM_RE)) {
    if (!seen.includes(m[0])) seen.push(m[0])
  }
  return seen
}

function termPresent(term: string, outLower: string): boolean {
  const need = Math.min(term.length - 3, 12)
  const ws = outLower.match(/[a-zà-öø-ÿ]+/g) ?? []
  return ws.some((w) => w.slice(0, need) === term.slice(0, need))
}

function normDash(s: string): string {
  return s.replace(/[‐‑‒–—−]/g, '-')
}

const CAP_RE = new RegExp(`[A-ZÀ-ÖØ-Þ][${W}À-ÖØ-öø-ÿ’'-]*`, 'gu')
const NUM_RE = /\d+(?:[.,:/‐‑‒–—−-]\d+)*/g

function rstripChars(s: string, chars: string): string {
  let end = s.length
  while (end > 0 && chars.includes(s[end - 1])) end--
  return s.slice(0, end)
}

/**
 * Numbers, dates and names a rewrite must keep: capitalised words not at a sentence start,
 * single-letter labels like V/R/M, and any document-level name (`names`) even at a sentence start.
 */
export function protectedTokens(text: string, lang = '', names: ReadonlySet<string> = new Set()): string[] {
  const toks: string[] = []
  const seen = new Set<string>()
  const add = (t: string) => {
    if (!seen.has(t)) {
      seen.add(t)
      toks.push(t)
    }
  }
  for (const m of text.matchAll(NUM_RE)) add(normDash(m[0]))
  for (const m of text.matchAll(CAP_RE)) {
    const w = rstripChars(m[0], '’\'-')
    let before = text.slice(0, m.index).trimEnd()
    before = rstripChars(before, '"“„‘\'«»”’')
    const initial = !before || '.!?:;…•\n'.includes(before[before.length - 1])
    if (initial && !names.has(w)) continue
    if (lang === 'en' && w === 'I') continue
    add(w)
  }
  return toks
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function present(tok: string, out: string): boolean {
  if (/^[\d.,:/-]+$/.test(tok)) return out.includes(tok)
  if ([...tok].length <= 2) {
    return new RegExp(`(?<![${NW}])${escapeRegExp(tok)}(?![${NW}])`, 'u').test(out)
  }
  if (out.includes(tok)) return true
  // tolerate inflection: "Nochlins" ↔ "Nochlin", "Pablita's"
  const stem = tok.replace(/(’s|'s|s)$/, '')
  return stem.length >= 3 && out.includes(stem)
}

function normSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(new RegExp(`[^${NW} ]+`, 'gu'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(t: string): string[] {
  return (t ?? '').split(/(?<=[.!?…])\s+/).filter((s) => s.trim())
}

function ngrams(ws: string[], n: number): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i + n <= ws.length; i++) {
    const g = ws.slice(i, i + n).join('\u0001')
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

const RATIO_BOUNDS: Record<string, [number, number]> = {
  light: [0.7, 1.4],
  medium: [0.6, 1.6],
  heavy: [0.5, 1.8],
}

/** Capitalised words that occur mid-sentence somewhere in the document — names everywhere. */
export function documentNames(texts: string[], lang = ''): Set<string> {
  const names = new Set<string>()
  for (const t of texts) {
    for (const tok of protectedTokens(t, lang)) {
      if (/^\p{Lu}/u.test(tok) && [...tok].length > 1) names.add(tok)
    }
  }
  return names
}

export interface CheckOptions {
  intensity?: string
  lang?: string
  ratio?: [number, number]
  checkTokens?: boolean
  names?: ReadonlySet<string>
}

/** Returns a list of problems with a rewritten block ([] = fine). */
export function checkBlock(srcIn: string, outIn: string, o: CheckOptions = {}): string[] {
  const intensity = o.intensity ?? 'medium'
  const lang = o.lang ?? ''
  const checkTokens = o.checkTokens ?? true
  const names = o.names ?? new Set<string>()
  const issues: string[] = []
  const src = (srcIn ?? '').trim()
  const out = (outIn ?? '').trim()
  if (!out) return ['empty output']
  // repeated sentences
  const srcCounts = new Map<string, number>()
  for (const s of sentences(src)) {
    const k = normSentence(s)
    srcCounts.set(k, (srcCounts.get(k) ?? 0) + 1)
  }
  const outCounts = new Map<string, number>()
  for (const s of sentences(out)) {
    const k = normSentence(s)
    if ([...k].length >= 20) outCounts.set(k, (outCounts.get(k) ?? 0) + 1)
  }
  const sg = ngrams(normSentence(src).split(' ').filter(Boolean), 8)
  const og = ngrams(normSentence(out).split(' ').filter(Boolean), 8)
  if ([...outCounts].some(([k, c]) => c > Math.max(1, srcCounts.get(k) ?? 0))) {
    issues.push('repeated sentence')
  } else if ([...og].some(([g, c]) => c > Math.max(1, sg.get(g) ?? 0))) {
    issues.push('repeated phrase')
  }
  let [lo, hi] = o.ratio ?? RATIO_BOUNDS[intensity] ?? RATIO_BOUNDS.medium
  if (src.length < 120) {
    lo *= 0.75
    hi *= 1.4
  }
  const r = out.length / Math.max(1, src.length)
  if (r < lo || r > hi) issues.push(`length ${r.toFixed(2)}× the original`)
  if (checkTokens) {
    const o2 = normDash(out)
    const missing = protectedTokens(src, lang, names).filter((t) => !present(t, o2))
    if (intensity === 'light' || intensity === 'medium') {
      const ol = o2.toLowerCase()
      missing.push(...keyTerms(src).filter((t) => !termPresent(t, ol)))
    }
    if (missing.length) issues.push('missing: ' + missing.slice(0, 8).join(', '))
    const normOut = out.replace(/\s+/g, ' ')
    const lost = quotedSpans(src).filter(
      (q) =>
        !new RegExp('[“„"‘\'«]\\s*' + escapeRegExp(q.replace(/\s+/g, ' ')) + '\\s*[”“"’\'»]').test(normOut),
    )
    if (lost.length) issues.push('quotation changed: ' + lost.slice(0, 3).map((q) => `“${q}”`).join('; '))
  }
  return issues
}
