// Word export of a humanized document: a fresh, clean .docx built from the blocks and outputs.
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import type { Paragraph, Table, TableCell, TextRun } from 'docx'
import { isTauri } from '../tauri'
import { toView, type ViewItem } from './render'
import type { Block } from './segment'

type Docx = typeof import('docx')

const BULLETS = 'humanize-bullets'
const NUMBERS = 'humanize-numbers'

function textRuns(d: Docx, text: string, bold = false): TextRun[] {
  const out: TextRun[] = []
  text.split('\n').forEach((line, i) => out.push(new d.TextRun({ text: line, bold, break: i > 0 ? 1 : undefined })))
  return out
}

function cell(d: Docx, text: string, bold: boolean): TableCell {
  return new d.TableCell({ children: [new d.Paragraph({ children: textRuns(d, text, bold) })] })
}

/** Builds the Word document: title, headings by level, paragraphs, bullet / numbered lists and tables (bold first row). */
export async function buildHumanizedDocx(
  title: string,
  blocks: Block[],
  outputs: Record<number, string>,
): Promise<Blob> {
  // Loaded on demand: the docx library is large and only needed when exporting.
  const d = await import('docx')
  const HEADINGS = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4]
  const children: (Paragraph | Table)[] = []
  if (title.trim()) {
    children.push(new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: textRuns(d, title.trim()) }))
  }

  let numberedInstance = 0
  let prev: ViewItem | null = null
  for (const item of toView(blocks, outputs)) {
    if (item.type === 'heading') {
      children.push(new d.Paragraph({ heading: HEADINGS[item.level - 1], children: textRuns(d, item.text) }))
    } else if (item.type === 'para') {
      children.push(new d.Paragraph({ spacing: { after: 160 }, children: textRuns(d, item.text) }))
    } else if (item.type === 'list') {
      if (item.ordered) {
        // A new numbered list (anything but a numbered item right before) restarts at 1.
        if (!(prev && prev.type === 'list' && prev.ordered)) numberedInstance += 1
        children.push(
          new d.Paragraph({
            numbering: { reference: NUMBERS, level: 0, instance: numberedInstance },
            children: textRuns(d, item.text),
          }),
        )
      } else {
        children.push(new d.Paragraph({ numbering: { reference: BULLETS, level: 0 }, children: textRuns(d, item.text) }))
      }
    } else {
      const rows = item.rows.filter((r) => r.length > 0)
      const ncols = Math.max(0, ...rows.map((r) => r.length))
      if (ncols > 0) {
        children.push(
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            rows: rows.map(
              (r, ri) =>
                new d.TableRow({
                  tableHeader: ri === 0,
                  children: Array.from({ length: ncols }, (_, ci) => cell(d, r[ci]?.text ?? '', ri === 0)),
                }),
            ),
          }),
          new d.Paragraph({ children: [] }),
        )
      }
    }
    prev = item
  }
  if (children.length === 0) children.push(new d.Paragraph({ children: [] }))

  const doc = new d.Document({
    title: title || undefined,
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            { level: 0, format: d.LevelFormat.BULLET, text: '•', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          ],
        },
        {
          reference: NUMBERS,
          levels: [
            { level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [{ children }],
  })
  return d.Packer.toBlob(doc)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

/**
 * Saves the .docx. In Tauri: native save dialog, then the `save_file_bytes` command.
 * In the browser: Blob URL and a temporary `<a download>`.
 * Resolves true when a file was written / the download started, false when the user cancelled the dialog.
 */
export async function saveHumanizedDocx(blob: Blob, filename: string): Promise<boolean> {
  if (isTauri()) {
    const path = await save({
      defaultPath: filename,
      filters: [{ name: 'Word document', extensions: ['docx'] }],
    })
    if (!path) return false
    await invoke('save_file_bytes', { path, base64: await blobToBase64(blob) })
    return true
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return true
}
