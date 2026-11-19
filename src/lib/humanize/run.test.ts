import { describe, expect, it } from 'vitest'
import type { ChatMessage, ChatOptions } from '../ollama'
import { blockNumPredict, generate, numCtxFor, runHumanize, type HumanizeEvent } from './run'

type Fake = (
  tag: string,
  messages: ChatMessage[],
  onToken: (t: string, full: string) => void,
  opts?: ChatOptions,
  signal?: AbortSignal,
) => Promise<string>

const DOC =
  '# Kop\n\nSofonisba Anguissola schilderde haar leraar terwijl hij haar portretteerde en kreeg lof van Vasari in 1559.\n\n' +
  'Fase | Notitie\nA | kort\nB | lang'

function fake(reply: (body: string, call: number, opts?: ChatOptions) => string): { chat: Fake; calls: { messages: ChatMessage[]; opts?: ChatOptions }[] } {
  const calls: { messages: ChatMessage[]; opts?: ChatOptions }[] = []
  const chat: Fake = async (_tag, messages, onToken, opts) => {
    calls.push({ messages, opts })
    const user = messages.find((m) => m.role === 'user')!.content
    const body = user.slice(user.lastIndexOf('<<<\n') + 4, user.lastIndexOf('\n>>>'))
    const text = reply(body, calls.length, opts)
    onToken(text, text)
    opts?.onDone?.({ doneReason: 'stop', evalCount: 10, evalDuration: 1e9 })
    return text
  }
  return { chat, calls }
}

describe('sizing', () => {
  it('scales num_predict with the block and clamps num_ctx to a power of two', () => {
    expect(blockNumPredict('kort')).toBe(256)
    const long = 'woord '.repeat(1000)
    expect(blockNumPredict(long)).toBeGreaterThanOrEqual(2.5 * Math.floor(long.length / 3) - 1)
    expect(numCtxFor(100, 256)).toBe(8192)
    expect(numCtxFor(30000, 2000)).toBe(16384)
    expect(numCtxFor(500000, 2000)).toBe(32768)
  })
})

describe('generate', () => {
  it('continues with an assistant prefill while done_reason is length', async () => {
    const seen: ChatMessage[][] = []
    const chat: Fake = async (_t, messages, onToken, opts) => {
      seen.push(messages.map((m) => ({ ...m })))
      const first = seen.length === 1
      const t = first ? 'Eerste helft ' : 'tweede helft.'
      onToken(t, t)
      opts?.onDone?.({ doneReason: first ? 'length' : 'stop', evalCount: 5, evalDuration: 5e8 })
      return t
    }
    const r = await generate(chat, 'm', [{ role: 'user', content: 'x' }], { temperature: 0.3, numPredict: 10 })
    expect(r.text).toBe('Eerste helft tweede helft.')
    expect(r.continuations).toBe(1)
    expect(seen[1][seen[1].length - 1]).toEqual({ role: 'assistant', content: 'Eerste helft ' })
  })

  it('stops after three continuations', async () => {
    let n = 0
    const chat: Fake = async (_t, _m, onToken, opts) => {
      n++
      onToken('x', 'x')
      opts?.onDone?.({ doneReason: 'length' })
      return 'x'
    }
    const r = await generate(chat, 'm', [{ role: 'user', content: 'x' }], { temperature: 0.3, numPredict: 10 })
    expect(n).toBe(4)
    expect(r.continuations).toBe(3)
  })
})

describe('runHumanize', () => {
  it('rewrites body blocks, keeps headings and table headers, and sends think:false', async () => {
    const { chat, calls } = fake((body) => body.replace('schilderde', 'portretteerde'))
    const events: HumanizeEvent[] = []
    const r = await runHumanize(DOC, 'doc', { tone: 'natural', strength: 'medium', model: 'm' }, (e) => events.push(e), chat)
    expect(r.cancelled).toBe(false)
    expect(r.flagged).toEqual([])
    const rewritten = r.blocks.filter((b) => b.rewrite)
    expect(Object.keys(r.outputs).map(Number)).toEqual(rewritten.map((b) => b.idx))
    expect(Object.values(r.outputs)[0]).toContain('portretteerde')
    expect(calls[0].opts?.think).toBe(false)
    expect(calls[0].opts?.temperature).toBe(0.6)
    expect(events[0].type).toBe('segmented')
    expect(events[events.length - 1].type).toBe('done')
  })

  it('retries once at temperature 0.2, then keeps the original and flags the block', async () => {
    const { chat, calls } = fake((body) => body + ' ' + body)
    const events: HumanizeEvent[] = []
    const r = await runHumanize(DOC, 'doc', { tone: 'natural', strength: 'medium', model: 'm' }, (e) => events.push(e), chat)
    const n = r.blocks.filter((b) => b.rewrite).length
    expect(r.flagged).toHaveLength(n)
    expect(calls).toHaveLength(2 * n)
    expect(calls[1].opts?.temperature).toBe(0.2)
    expect(calls[1].messages[1].content).toContain('Important — your previous attempt')
    for (const f of r.flagged) {
      expect(r.outputs[f.idx]).toBe(r.blocks[f.idx].text)
      expect(f.rejected.length).toBeGreaterThan(0)
    }
    const flagEvents = events.filter((e) => e.type === 'flag')
    expect(flagEvents).toHaveLength(n)
  })

  it('stops when aborted', async () => {
    const ac = new AbortController()
    const { chat } = fake((body) => {
      ac.abort()
      return body
    })
    const r = await runHumanize(DOC, 'doc', { tone: 'natural', strength: 'medium', model: 'm', signal: ac.signal }, () => {}, chat)
    expect(r.cancelled).toBe(true)
    expect(Object.keys(r.outputs)).toHaveLength(0)
  })
})
