// Port of persephone/server/humanize.py `generate`, `stream_humanize` and the sizing helpers.
// Talks to Ollama through chatStream (think:false); the model is never unloaded here.
import { chatStream, type ChatMessage, type ChatOptions } from '../ollama'
import { checkBlock, cleanOutput, documentNames } from './guard'
import { detectLanguage } from './language'
import { buildBlockMessages, RETRY_TEMPERATURE, temperature, type Strength, type Tone } from './prompts'
import { blockBody, contexts, segmentText, type Block } from './segment'

export const MAX_CONTINUATIONS = 3
export const NUM_CTX_MIN = 8192
export const NUM_CTX_MAX = 32768

export function estTokens(text: string): number {
  return Math.max(1, Math.floor((text ?? '').length / 3))
}

export function blockNumPredict(text: string, factor = 2.5, floor = 256): number {
  return Math.trunc(Math.max(floor, factor * estTokens(text)))
}

/** Context window for prompt + generation: a power of two clamped to [8192, 32768] (`_num_ctx_for`). */
export function numCtxFor(promptChars: number, numPredict: number, extraTokens = 0): number {
  const est = Math.floor(promptChars / 3) + Math.trunc(numPredict) + 256 + Math.trunc(extraTokens)
  let p = 1
  while (p < Math.max(est, 1)) p *= 2
  return Math.min(NUM_CTX_MAX, Math.max(NUM_CTX_MIN, p))
}

export interface RunStats {
  evalCount: number
  /** Nanoseconds spent generating, as reported by Ollama. */
  evalNs: number
  calls: number
  continuations: number
  totalMs: number
  tokPerSec: number
}

export interface FlaggedBlock {
  /** 1-based position among the rewritten blocks. */
  i: number
  /** Block idx. */
  idx: number
  issues: string[]
  preview: string
  /** Cleaned text of the last failed attempt ('' if none), so review can still offer it. */
  rejected: string
}

export type HumanizeEvent =
  | { type: 'segmented'; of: number; blocks: Block[]; language: string; model: string }
  | { type: 'block'; i: number; of: number; idx: number }
  | { type: 'draft'; delta: string }
  | { type: 'draftReset' }
  | { type: 'output'; idx: number; text: string }
  | { type: 'flag'; flag: FlaggedBlock }
  | { type: 'stats'; stats: RunStats }
  | { type: 'done'; stats: RunStats; flagged: FlaggedBlock[]; language: string }

export interface RunOptions {
  tone: Tone
  strength: Strength
  model: string
  signal?: AbortSignal
}

export interface RunResult {
  blocks: Block[]
  outputs: Record<number, string>
  flagged: FlaggedBlock[]
  language: string
  stats: RunStats
  cancelled: boolean
}

type Chat = typeof chatStream

export interface Tally {
  evalCount: number
  evalNs: number
  calls: number
  continuations: number
  t0: number
}

function snapshot(t: Tally): RunStats {
  return {
    evalCount: t.evalCount,
    evalNs: t.evalNs,
    calls: t.calls,
    continuations: t.continuations,
    totalMs: Date.now() - t.t0,
    tokPerSec: t.evalNs ? Math.round((t.evalCount / (t.evalNs / 1e9)) * 10) / 10 : 0,
  }
}

/**
 * Runs a chat call, continuing with an assistant prefill while done_reason == 'length'
 * (at most MAX_CONTINUATIONS extra calls).
 */
export async function generate(
  chat: Chat,
  model: string,
  messages: ChatMessage[],
  o: {
    temperature: number
    numPredict: number
    signal?: AbortSignal
    onDelta?: (delta: string) => void
    tally?: Tally
    onCall?: () => void
  },
): Promise<{ text: string; doneReason: string; continuations: number }> {
  let out = ''
  let conts = 0
  let reason = 'stop'
  const promptChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0)
  for (;;) {
    const msgs = out ? [...messages, { role: 'assistant' as const, content: out }] : messages
    const opts: ChatOptions = {
      think: false,
      temperature: o.temperature,
      numPredict: Math.trunc(o.numPredict),
      numCtx: numCtxFor(promptChars + out.length, o.numPredict),
      onDone: (info) => {
        reason = info.doneReason || 'stop'
        if (o.tally) {
          o.tally.evalCount += info.evalCount ?? 0
          o.tally.evalNs += info.evalDuration ?? 0
        }
      },
    }
    reason = 'stop'
    if (o.tally) o.tally.calls += 1
    await chat(
      model,
      msgs,
      (token) => {
        out += token
        o.onDelta?.(token)
      },
      opts,
      o.signal,
    )
    o.onCall?.()
    if (o.signal?.aborted) break
    if (reason === 'length' && conts < MAX_CONTINUATIONS) {
      conts += 1
      if (o.tally) o.tally.continuations += 1
      continue
    }
    break
  }
  return { text: out, doneReason: reason, continuations: conts }
}

/**
 * Humanizes `text` block by block (see humanize.py: segment, classify, rewrite each body block
 * with neighbour context, quality-guard it, retry once at temperature 0.2, else keep the original
 * and flag it). Events stream through `onEvent`; abort `opts.signal` to cancel (resolves with
 * `cancelled: true` and whatever finished so far). Ollama errors are thrown.
 */
export async function runHumanize(
  text: string,
  title: string,
  opts: RunOptions,
  onEvent: (e: HumanizeEvent) => void,
  chat: Chat = chatStream,
): Promise<RunResult> {
  const { tone, strength, model, signal } = opts
  const blocks = segmentText(text)
  const language = detectLanguage(blocks.map((b) => b.text).join('\n'))
  const names = documentNames(
    blocks.map((b) => b.text),
    language,
  )
  const ctxs = contexts(blocks, title)
  const todo = blocks.filter((b) => b.rewrite)
  const total = todo.length
  const tally: Tally = { evalCount: 0, evalNs: 0, calls: 0, continuations: 0, t0: Date.now() }
  const outputs: Record<number, string> = {}
  const flagged: FlaggedBlock[] = []
  const finish = (cancelled: boolean): RunResult => {
    const stats = snapshot(tally)
    if (!cancelled) onEvent({ type: 'done', stats, flagged, language })
    return { blocks, outputs, flagged, language, stats, cancelled }
  }
  onEvent({ type: 'segmented', of: total, blocks, language, model })

  let k = 0
  for (const b of blocks) {
    if (!b.rewrite) continue
    if (signal?.aborted) return finish(true)
    k += 1
    onEvent({ type: 'block', i: k, of: total, idx: b.idx })
    const src = blockBody(b).trim()
    let final: string | null = null
    let issues: string[] = []
    let lastCleaned = ''
    for (const attempt of [0, 1]) {
      const msgs = buildBlockMessages(b, ctxs.get(b.idx) ?? {}, {
        lang: language,
        tone,
        intensity: strength,
        issues: attempt ? issues : null,
      })
      const temp = attempt === 0 ? temperature(strength) : RETRY_TEMPERATURE
      const gen = await generate(chat, model, msgs, {
        temperature: temp,
        numPredict: blockNumPredict(src),
        signal,
        tally,
        onDelta: (delta) => onEvent({ type: 'draft', delta }),
        onCall: () => onEvent({ type: 'stats', stats: snapshot(tally) }),
      })
      if (signal?.aborted) {
        onEvent({ type: 'draftReset' })
        return finish(true)
      }
      const cleaned = cleanOutput(gen.text, b)
      lastCleaned = cleaned
      issues = checkBlock(src, cleaned, { intensity: strength, lang: language, names })
      if (!issues.length) {
        final = cleaned
        break
      }
      onEvent({ type: 'draftReset' })
    }
    if (final === null) {
      final = src
      const flag: FlaggedBlock = { i: k, idx: b.idx, issues, preview: src.slice(0, 120), rejected: lastCleaned }
      flagged.push(flag)
      onEvent({ type: 'flag', flag })
    }
    const outText = b.prefix ? `${b.prefix}${b.sep || ' '}${final}` : final
    outputs[b.idx] = outText
    onEvent({ type: 'draftReset' })
    onEvent({ type: 'output', idx: b.idx, text: outText })
  }
  return finish(false)
}
