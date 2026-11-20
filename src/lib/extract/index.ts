// Shared document reading: every text-native format becomes light markdown for the Humanize segmenter.
import { invoke } from '@tauri-apps/api/core'
import mammoth from 'mammoth'
import { isTauri } from '../tauri'
import { htmlToMarkdown } from './html'
import { rtfToText } from './rtf'
import { odtToText } from './odt'
import { epubToText } from './epub'
import { pagesToText } from './pages'
import { decodeText, plainToText } from './plain'

export const TEXT_EXTENSIONS = [
  'docx', 'doc', 'pages', 'rtf', 'odt', 'txt', 'md', 'markdown', 'html', 'htm', 'xhtml', 'epub', 'webarchive', 'wordml',
] as const
export const OCR_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'tif', 'bmp', 'heic'] as const
export const ALL_EXTENSIONS: string[] = [...TEXT_EXTENSIONS, ...OCR_EXTENSIONS]

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

/** Formats that are only readable through macOS `textutil` (the Tauri app). */
export function needsApp(ext: string): boolean {
  return ext === 'doc' || ext === 'webarchive' || ext === 'wordml'
}

export interface ExtractOptions {
  /** OCR of a JPEG (used for the Pages preview fallback). */
  ocrJpeg?: (jpeg: Uint8Array) => Promise<string>
}

export interface ExtractResult {
  text: string
  note?: string
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export async function extractDocument(
  name: string,
  bytes: Uint8Array,
  path?: string,
  opts: ExtractOptions = {},
): Promise<ExtractResult> {
  const ext = extensionOf(name)
  let result: ExtractResult

  if (needsApp(ext)) {
    if (!path || !isTauri()) throw new Error('Open this file in the app')
    const html = await invoke<string>('convert_with_textutil', { path, to: 'html' })
    result = { text: htmlToMarkdown(html) }
  } else {
    switch (ext) {
      case 'docx': {
        const r = await mammoth.convertToHtml({ arrayBuffer: toArrayBuffer(bytes) })
        result = { text: htmlToMarkdown(r.value) }
        break
      }
      case 'html':
      case 'htm':
      case 'xhtml':
        result = { text: htmlToMarkdown(decodeText(bytes)) }
        break
      case 'rtf':
        result = { text: rtfToText(decodeText(bytes)) }
        break
      case 'odt':
        result = { text: await odtToText(bytes) }
        break
      case 'epub':
        result = { text: await epubToText(bytes) }
        break
      case 'pages':
        result = await pagesToText(bytes, opts.ocrJpeg)
        break
      case 'txt':
      case 'md':
      case 'markdown':
        result = { text: plainToText(bytes) }
        break
      default:
        throw new Error(`Unsupported file type: ${name}`)
    }
  }

  if (!result.text.trim()) throw new Error(`No text found in ${name}.`)
  return result
}

export async function extractText(
  name: string,
  bytes: Uint8Array,
  path?: string,
  opts?: ExtractOptions,
): Promise<string> {
  return (await extractDocument(name, bytes, path, opts)).text
}
