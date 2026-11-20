import { invoke } from '@tauri-apps/api/core'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import { isTauri } from './tauri'
import { ocrImage, OllamaError } from './ollama'
import { readSettings } from './settings'
import { fontProfileOfDocument, pageToMarkdown, stripRunningLines, type FontProfile, type PageMarkdown } from './extract/pdfText'
import { OCR_EXTENSIONS, TEXT_EXTENSIONS, extensionOf, extractDocument } from './extract'

const ALL_TEXT = new Set<string>(TEXT_EXTENSIONS)

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/** 'docx' is kept for persisted data; 'document' is any other text-native format (no OCR). */
export type SourceKind = 'pdf' | 'image' | 'docx' | 'document'
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
  /** A non-fatal remark about how the text was read, e.g. "only the first page". */
  note?: string
  /** The Tauri filesystem path this source was added from, when applicable (browser file inputs have none). */
  path?: string
}

export type SourceInput = { path: string } | { file: File }

const IMAGE_EXTENSIONS = new Set<string>(OCR_EXTENSIONS.filter(ext => ext !== 'pdf'))

export function kindFromName(name: string): SourceKind | null {
  const ext = extensionOf(name)
  if (!ext) return null
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return ALL_TEXT.has(ext) ? 'document' : null
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
    case 'tif':
      return 'image/tiff'
    case 'heic':
      return 'image/heic'
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

/** Render one pdf.js page to a PNG (base64, no prefix). */
export async function renderPdfPage(page: PDFPageProxy, scale = 1.6): Promise<string> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) throw new Error('Could not create a 2D canvas context.')

  await page.render({ canvas, canvasContext, viewport }).promise
  const png = stripPngPrefix(canvas.toDataURL('image/png'))
  canvas.width = 0
  canvas.height = 0
  return png
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

export async function processSource(
  input: SourceInput,
  ocrTag: string,
  onUpdate: (patch: Partial<Source>) => void,
  signal?: AbortSignal,
): Promise<{ usedOcr: boolean }> {
  let usedOcr = false
  try {
    const { name, bytes } = await readBytes(input)
    const kind = kindFromName(name)
    if (!kind) {
      onUpdate({ status: 'error', error: `Unsupported file type: ${name}` })
      return { usedOcr }
    }
    if (signal?.aborted) return { usedOcr }

    if (kind === 'docx' || kind === 'document') {
      onUpdate({ status: 'extracting', progress: { page: 0, pages: 1 } })
      const result = await extractDocument(name, bytes, 'path' in input ? input.path : undefined, {
        ocrJpeg: async jpeg => {
          // Pages preview fallback: needs the OCR model.
          const tag = readSettings().ocrTag
          if (!tag) throw new Error('Pick an OCR model to read this Pages file.')
          const page = await imageToPng(jpeg, 'image/jpeg')
          return (await ocrImage(tag, page.pngBase64, signal)).text
        },
      })
      if (signal?.aborted) return { usedOcr }
      onUpdate({
        status: 'done',
        pages: 1,
        progress: { page: 1, pages: 1 },
        text: result.text,
        note: result.note,
      })
      return { usedOcr }
    }

    if (kind === 'image') {
      onUpdate({ status: 'rendering', pages: 1, progress: { page: 0, pages: 1 } })
      const page = await imageToPng(bytes, mimeFromName(name))
      if (signal?.aborted) return { usedOcr }

      onUpdate({ status: 'extracting', progress: { page: 0, pages: 1 } })
      usedOcr = true
      const result = await ocrImage(ocrTag, page.pngBase64, signal)
      if (signal?.aborted) return { usedOcr }
      onUpdate({ status: 'done', progress: { page: 1, pages: 1 }, text: result.text })
      return { usedOcr }
    }

    // pdf: read the text layer page by page, OCR only the pages that have none.
    onUpdate({ status: 'rendering', progress: { page: 0, pages: 0 } })
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise
    const total = doc.numPages
    if (total < 1) {
      onUpdate({ status: 'error', error: 'This PDF has no pages.' })
      return { usedOcr }
    }
    onUpdate({ pages: total, progress: { page: 0, pages: total }, status: 'extracting' })

    const useText = readSettings().pdfTextLayer
    // First pass (sizes only) so heading levels are ranked across the whole document.
    let profile: FontProfile | undefined
    if (useText) {
      try {
        profile = await fontProfileOfDocument(doc)
      } catch {
        profile = undefined
      }
    }
    const slots: ({ kind: 'text'; md: PageMarkdown } | { kind: 'ocr'; text: string } | { kind: 'skipped' })[] = []
    const joined = () =>
      slots
        .map(sl => (sl.kind === 'text' ? sl.md.text : sl.kind === 'ocr' ? sl.text : ''))
        .filter(Boolean)
        .join('\n\n')

    for (let i = 1; i <= total; i++) {
      if (signal?.aborted) return { usedOcr }
      const page = await doc.getPage(i)
      let md: PageMarkdown | null = null
      if (useText) {
        try {
          md = await pageToMarkdown(page, profile)
        } catch {
          md = null
        }
      }
      if (md && md.verdict === 'text') {
        slots.push({ kind: 'text', md })
      } else if (ocrTag) {
        const png = await renderPdfPage(page)
        if (signal?.aborted) return { usedOcr }
        usedOcr = true
        const result = await ocrImage(ocrTag, png, signal)
        slots.push({ kind: 'ocr', text: result.text })
      } else {
        slots.push({ kind: 'skipped' })
      }
      page.cleanup()
      onUpdate({ progress: { page: i, pages: total }, text: joined() })
    }
    if (signal?.aborted) return { usedOcr }

    // Drop running headers and footers, then report how the document was read.
    const textIdx: number[] = []
    slots.forEach((sl, i) => {
      if (sl.kind === 'text') textIdx.push(i)
    })
    const stripped = stripRunningLines(textIdx.map(i => (slots[i] as { kind: 'text'; md: PageMarkdown }).md))
    textIdx.forEach((slotIndex, k) => {
      slots[slotIndex] = { kind: 'text', md: stripped[k] }
    })

    const textCount = textIdx.length
    const ocrCount = slots.filter(sl => sl.kind === 'ocr').length
    const skipped = slots.flatMap((sl, i) => (sl.kind === 'skipped' ? [i + 1] : []))
    const text = joined()

    if (!textCount && skipped.length === total) {
      onUpdate({
        status: 'error',
        text: '',
        note: undefined,
        error: 'This PDF is scanned. Set up the OCR model to read it.',
      })
      return { usedOcr }
    }

    let note: string | undefined
    if (skipped.length) {
      note = `Read ${pagesLabel(textCount + ocrCount)}${ocrCount ? ` (${ocrCount} with OCR)` : ''}; ${pagesList(skipped)} ${skipped.length === 1 ? 'is' : 'are'} scanned and need${skipped.length === 1 ? 's' : ''} the OCR model.`
    } else if (textCount && !ocrCount) {
      note = 'Read from the text (no OCR needed)'
    } else if (textCount) {
      note = `Read ${pagesLabel(textCount)} from the text, ${ocrCount} with OCR`
    }
    onUpdate({ status: 'done', progress: { page: total, pages: total }, text, note })
    return { usedOcr }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { usedOcr }
    if (e instanceof OllamaError && e.kind === 'offline') {
      onUpdate({ status: 'error', error: 'Ollama is not running. Start it and try again.' })
      return { usedOcr }
    }
    const message = e instanceof Error ? e.message : String(e)
    onUpdate({ status: 'error', error: message })
  }
  return { usedOcr }
}

function pagesLabel(n: number): string {
  return n === 1 ? '1 page' : `${n} pages`
}

function pagesList(pages: number[]): string {
  if (pages.length > 6) return `${pages.length} pages`
  if (pages.length === 1) return `page ${pages[0]}`
  return `pages ${pages.slice(0, -1).join(', ')} and ${pages[pages.length - 1]}`
}
