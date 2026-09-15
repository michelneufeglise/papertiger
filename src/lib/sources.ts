import { invoke } from '@tauri-apps/api/core'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { isTauri } from './tauri'
import { ocrImage, OllamaError } from './ollama'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type SourceKind = 'pdf' | 'image' | 'docx'
export type SourceStatus = 'queued' | 'rendering' | 'extracting' | 'done' | 'error'

export interface SourcePage {
  index: number
  pngBase64: string
  text?: string
}

export interface Source {
  id: string
  name: string
  kind: SourceKind
  sizeBytes: number
  addedAt: Date
  status: SourceStatus
  progress: { page: number; pages: number }
  pages: number
  text: string
  error?: string
}

export type SourceInput = { path: string } | { file: File }

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'bmp'])

export function kindFromName(name: string): SourceKind | null {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0) return null
  const ext = name.slice(dotIndex + 1).toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return null
}

function mimeFromName(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  const ext = dotIndex < 0 ? '' : name.slice(dotIndex + 1).toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'tiff':
      return 'image/tiff'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'image/png'
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function stripPngPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/png;base64,/, '')
}

export async function readBytes(input: SourceInput): Promise<{ name: string; bytes: Uint8Array }> {
  if ('file' in input) {
    const buf = await input.file.arrayBuffer()
    return { name: input.file.name, bytes: new Uint8Array(buf) }
  }

  const name = input.path.split(/[\\/]/).pop() ?? input.path
  if (!isTauri()) {
    throw new Error('A file path input requires the Tauri runtime.')
  }
  const base64 = await invoke<string>('read_file_base64', { path: input.path })
  return { name, bytes: base64ToBytes(base64) }
}

export async function renderPdfPages(
  bytes: Uint8Array,
  opts?: { scale?: number; maxPages?: number },
): Promise<SourcePage[]> {
  const scale = opts?.scale ?? 1.6
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise
  const pageCount = opts?.maxPages ? Math.min(doc.numPages, opts.maxPages) : doc.numPages

  const pages: SourcePage[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) throw new Error('Could not create a 2D canvas context.')

    await page.render({ canvas, canvasContext, viewport }).promise
    pages.push({ index: i - 1, pngBase64: stripPngPrefix(canvas.toDataURL('image/png')) })
  }

  return pages
}

export async function imageToPng(bytes: Uint8Array, mime: string): Promise<SourcePage> {
  const bitmap = await createImageBitmap(new Blob([toArrayBuffer(bytes)], { type: mime }))
  const maxSide = 2000
  let { width, height } = bitmap
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return { index: 0, pngBase64: stripPngPrefix(canvas.toDataURL('image/png')) }
}

export async function docxToText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: toArrayBuffer(bytes) })
  return result.value
}

export async function processSource(
  input: SourceInput,
  ocrTag: string,
  onUpdate: (patch: Partial<Source>) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const { name, bytes } = await readBytes(input)
    const kind = kindFromName(name)
    if (!kind) {
      onUpdate({ status: 'error', error: `Unsupported file type: ${name}` })
      return
    }
    if (signal?.aborted) return

    if (kind === 'docx') {
      onUpdate({ status: 'extracting', progress: { page: 0, pages: 1 } })
      const text = await docxToText(bytes)
      if (signal?.aborted) return
      onUpdate({ status: 'done', pages: 1, progress: { page: 1, pages: 1 }, text })
      return
    }

    if (kind === 'image') {
      onUpdate({ status: 'rendering', pages: 1, progress: { page: 0, pages: 1 } })
      const page = await imageToPng(bytes, mimeFromName(name))
      if (signal?.aborted) return

      onUpdate({ status: 'extracting', progress: { page: 0, pages: 1 } })
      const result = await ocrImage(ocrTag, page.pngBase64, signal)
      if (signal?.aborted) return
      onUpdate({ status: 'done', progress: { page: 1, pages: 1 }, text: result.text })
      return
    }

    // pdf
    onUpdate({ status: 'rendering', progress: { page: 0, pages: 0 } })
    const pages = await renderPdfPages(bytes)
    if (signal?.aborted) return
    onUpdate({ pages: pages.length, progress: { page: 0, pages: pages.length } })

    onUpdate({ status: 'extracting' })
    let text = ''
    for (const page of pages) {
      if (signal?.aborted) return
      const result = await ocrImage(ocrTag, page.pngBase64, signal)
      text = text ? `${text}\n\n${result.text}` : result.text
      onUpdate({ progress: { page: page.index + 1, pages: pages.length }, text })
    }

    onUpdate({ status: 'done' })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    if (e instanceof OllamaError && e.kind === 'offline') {
      onUpdate({ status: 'error', error: 'Ollama is not running. Start it and try again.' })
      return
    }
    const message = e instanceof Error ? e.message : String(e)
    onUpdate({ status: 'error', error: message })
  }
}
