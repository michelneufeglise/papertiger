// Export of a humanized document in every common format, built from toView(blocks, outputs)
// so review decisions (effectiveOutputs) are respected everywhere.
import { renderMarkdown, toView } from '../render'
import type { Block } from '../segment'
import { buildHumanizedDocx } from '../docx'
import { buildHtml } from './html'
import { buildRtf } from './rtf'
import { buildText } from './text'
import { downloadBlob, saveFile, writeBlob, writeTextutil } from './save'

export type ExportFormat = 'docx' | 'pdf' | 'doc' | 'rtf' | 'odt' | 'html' | 'md' | 'txt'

export interface ExportFormatInfo {
  id: ExportFormat
  label: string
  ext: string
  mime: string
  /** Needs the Tauri shell (the legacy .doc is written by macOS textutil). */
  tauriOnly: boolean
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { id: 'docx', label: 'Word (.docx)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', tauriOnly: false },
  { id: 'pdf', label: 'PDF (.pdf)', ext: 'pdf', mime: 'application/pdf', tauriOnly: false },
  { id: 'doc', label: 'Word 97 (.doc)', ext: 'doc', mime: 'application/msword', tauriOnly: true },
  { id: 'rtf', label: 'Rich text (.rtf)', ext: 'rtf', mime: 'application/rtf', tauriOnly: false },
  { id: 'odt', label: 'OpenDocument (.odt)', ext: 'odt', mime: 'application/vnd.oasis.opendocument.text', tauriOnly: false },
  { id: 'html', label: 'Web page (.html)', ext: 'html', mime: 'text/html', tauriOnly: false },
  { id: 'md', label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', tauriOnly: false },
  { id: 'txt', label: 'Plain text (.txt)', ext: 'txt', mime: 'text/plain', tauriOnly: false },
]

export const formatInfo = (id: ExportFormat): ExportFormatInfo => EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0]

export type ExportData = Blob | { html: string }

const textBlob = (s: string, mime: string) => new Blob([s], { type: `${mime};charset=utf-8` })

export async function exportDocument(
  format: ExportFormat,
  title: string,
  blocks: Block[],
  outputs: Record<number, string> = {},
): Promise<ExportData> {
  if (format === 'docx') return buildHumanizedDocx(title, blocks, outputs)
  if (format === 'md') {
    const md = renderMarkdown(blocks, outputs)
    return textBlob((title.trim() ? `# ${title.trim()}\n\n` : '') + md + '\n', 'text/markdown')
  }
  const items = toView(blocks, outputs)
  switch (format) {
    case 'pdf': return (await import('./pdf')).buildPdf(title, items)
    case 'rtf': return new Blob([buildRtf(title, items)], { type: 'application/rtf' })
    case 'odt': return (await import('./odt')).buildOdt(title, items)
    case 'html': return textBlob(buildHtml(title, items), 'text/html')
    case 'doc': return { html: buildHtml(title, items) }
    default: return textBlob(buildText(title, items), 'text/plain')
  }
}

/** Saves the export. Resolves true when written / downloaded, false when the dialog was cancelled. */
export async function saveExport(format: ExportFormat, data: ExportData, filename: string): Promise<boolean> {
  const info = formatInfo(format)
  const filter = { name: info.label, extensions: [info.ext] }
  if ('html' in data) {
    return saveFile(filename, filter, writeTextutil(data.html), () => {
      // No textutil in the browser: fall back to the HTML page.
      downloadBlob(textBlob(data.html, 'text/html'), filename.replace(/\.doc$/i, '.html'))
    })
  }
  return saveFile(filename, filter, writeBlob(data), () => downloadBlob(data, filename))
}
