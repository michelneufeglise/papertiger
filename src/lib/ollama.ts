import { OCR_NUM_CTX, sameTag } from './models'

const BASE_URL = 'http://localhost:11434'

export type OllamaErrorKind = 'offline' | 'http' | 'parse'

export class OllamaError extends Error {
  kind: OllamaErrorKind

  constructor(kind: OllamaErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'OllamaError'
    this.kind = kind
  }
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

async function fetchOllama(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, init)
  } catch (e) {
    if (isAbortError(e)) throw e
    throw new OllamaError('offline', 'Ollama is not running. Start it and try again.')
  }
}

export interface OllamaStatus {
  online: boolean
  version?: string
}

export async function getStatus(): Promise<OllamaStatus> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const res = await fetch(`${BASE_URL}/api/version`, { signal: controller.signal })
    if (!res.ok) return { online: false }
    const data = (await res.json()) as { version?: unknown }
    return {
      online: true,
      version: typeof data.version === 'string' ? data.version : undefined,
    }
  } catch {
    return { online: false }
  } finally {
    clearTimeout(timeout)
  }
}

export interface OllamaModel {
  name: string
  sizeBytes: number
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetchOllama('/api/tags')
  if (!res.ok) throw new OllamaError('http', `GET /api/tags failed: ${res.status}`)

  let data: { models?: Array<{ name?: unknown; model?: unknown; size?: unknown }> }
  try {
    data = await res.json()
  } catch {
    throw new OllamaError('parse', 'Could not parse /api/tags response.')
  }

  const models = Array.isArray(data.models) ? data.models : []
  return models.map((m) => ({
    name: String(m.name ?? m.model ?? ''),
    sizeBytes: typeof m.size === 'number' ? m.size : 0,
  }))
}

export async function hasModel(tag: string): Promise<boolean> {
  const models = await listModels()
  return models.some((m) => sameTag(m.name, tag))
}

export interface PullProgress {
  status: string
  completed?: number
  total?: number
  percent: number
}

function handlePullLine(line: string, onProgress: (p: PullProgress) => void): void {
  let parsed: { status?: unknown; completed?: unknown; total?: unknown; error?: unknown }
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new OllamaError('parse', `Could not parse pull progress line: ${line}`)
  }

  if (parsed.error) {
    throw new OllamaError('http', String(parsed.error))
  }

  const status = typeof parsed.status === 'string' ? parsed.status : ''
  const completed = typeof parsed.completed === 'number' ? parsed.completed : undefined
  const total = typeof parsed.total === 'number' ? parsed.total : undefined

  let percent = 0
  if (status === 'success') {
    percent = 100
  } else if (completed != null && total) {
    percent = (completed / total) * 100
  }

  onProgress({ status, completed, total, percent })
}

export async function pullModel(
  tag: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetchOllama('/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tag, stream: true }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new OllamaError('http', `POST /api/pull failed: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) handlePullLine(line, onProgress)
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const trailing = buffer.trim()
  if (trailing) handlePullLine(trailing, onProgress)
}

export interface OcrBlock {
  label: string
  bbox: [number, number, number, number] | null
  text: string
}

const BLOCK_LINE_RE = /^([a-z_]+) \[(\d+), (\d+), (\d+), (\d+)\](.*)$/

function stripLatex(text: string): string {
  return text.replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/\\%/g, '%')
}

export function parseOcrOutput(raw: string): OcrBlock[] {
  const lines = raw.split(/\r?\n/)
  const blocks: OcrBlock[] = []

  for (const line of lines) {
    const match = line.match(BLOCK_LINE_RE)
    if (match) {
      const [, label, x1, y1, x2, y2, text] = match
      blocks.push({
        label,
        bbox: [Number(x1), Number(y1), Number(x2), Number(y2)],
        text: stripLatex(text),
      })
      continue
    }

    if (blocks.length === 0) continue // junk preamble before the first block

    const trimmed = line.trim()
    if (!trimmed) continue

    const last = blocks[blocks.length - 1]
    last.text = `${last.text} ${stripLatex(trimmed)}`.trim()
  }

  return blocks
}

function parseTableRows(html: string): string[][] | null {
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (rowMatches.length === 0) return null

  const rows = rowMatches.map((rowMatch) => {
    const cellMatches = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    return cellMatches.map((c) => c[1].replace(/<[^>]+>/g, '').trim())
  })

  return rows
}

export function blocksToText(blocks: OcrBlock[]): string {
  const paragraphs: string[] = []

  for (const block of blocks) {
    if (block.label === 'table') {
      const rows = parseTableRows(block.text)
      paragraphs.push(rows && rows.length > 0 ? rows.map((row) => row.join(' | ')).join('\n') : block.text)
    } else {
      paragraphs.push(block.text)
    }
  }

  return paragraphs.join('\n\n')
}

export async function ocrImage(
  tag: string,
  pngBase64: string,
  signal?: AbortSignal,
): Promise<{ raw: string; blocks: OcrBlock[]; text: string }> {
  const res = await fetchOllama('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: tag,
      prompt: 'ocr',
      images: [pngBase64],
      stream: false,
      options: { num_ctx: OCR_NUM_CTX },
      keep_alive: '10m',
    }),
    signal,
  })
  if (!res.ok) throw new OllamaError('http', `POST /api/generate failed: ${res.status}`)

  let data: { response?: unknown }
  try {
    data = await res.json()
  } catch {
    throw new OllamaError('parse', 'Could not parse /api/generate response.')
  }

  const raw = typeof data.response === 'string' ? data.response : ''
  const blocks = parseOcrOutput(raw)
  const text = blocksToText(blocks)
  return { raw, blocks, text }
}
