import type { ChatMessage, ChatOptions } from './ollama'
import { chatStream, stripThinking } from './ollama'
import { WRITER_NUM_CTX, writerById } from './models'
import { readSettings } from './settings'
import { getSources } from './sourcesStore'
import { getPaper, updateSection } from './paper'

export interface WriteContext {
  paperTitle: string
  sectionTitle: string
  otherSections: { title: string; content: string }[]
  sources: { name: string; text: string }[]
  intent: string[] // recent user chat messages
}

const SYSTEM_PROMPT =
  'You are papertiger, an academic writing assistant running fully on this Mac. Write in clear, ' +
  'correct academic English. Use only the source excerpts provided; do not invent citations or ' +
  'numbers. Output plain paragraphs only: no markdown headings, no bullet lists, no preamble, no ' +
  'closing remarks.'

const SOURCE_CHAR_BUDGET = 9000
const OTHER_SECTION_SUMMARY_CHARS = 300

export function buildSectionMessages(ctx: WriteContext): ChatMessage[] {
  const lines: string[] = []
  lines.push(`Paper title: ${ctx.paperTitle}`)
  lines.push('')
  lines.push(`Write the section: ${ctx.sectionTitle}`)

  const summaries = ctx.otherSections
    .map(section => ({ title: section.title, summary: section.content.slice(0, OTHER_SECTION_SUMMARY_CHARS).trim() }))
    .filter(section => section.summary.length > 0)

  if (summaries.length > 0) {
    lines.push('')
    lines.push('Other sections already written (for context; do not repeat them):')
    for (const section of summaries) lines.push(`- ${section.title}: ${section.summary}`)
  }

  if (ctx.intent.length > 0) {
    lines.push('')
    lines.push("Notes from the author's recent messages:")
    for (const line of ctx.intent) lines.push(`- ${line}`)
  }

  lines.push('')
  if (ctx.sources.length === 0) {
    lines.push('No sources have been added. Write from the notes above only.')
  } else {
    lines.push('Source excerpts:')
    const perSourceBudget = Math.max(1, Math.floor(SOURCE_CHAR_BUDGET / ctx.sources.length))
    for (const source of ctx.sources) {
      lines.push('')
      lines.push(`### ${source.name}`)
      lines.push(source.text.slice(0, perSourceBudget))
    }
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ]
}

// Set by chat.ts at module init so writer.ts can read recent user intent without a
// static import of chat.ts (which would create a paper.ts <-> writer.ts <-> chat.ts cycle).
let intentProvider: () => string[] = () => []

export function setIntentProvider(fn: () => string[]): void {
  intentProvider = fn
}

export async function writeSection(sectionId: string, signal?: AbortSignal): Promise<void> {
  const settings = readSettings()
  if (!settings.writerTag || !settings.writerId) {
    throw new Error('No writer model configured')
  }
  const model = writerById(settings.writerId)
  if (!model) {
    throw new Error('No writer model configured')
  }

  const paper = getPaper()
  const section = paper.sections.find(s => s.id === sectionId)
  if (!section) return

  const sources = getSources().filter(s => s.status === 'done')

  const ctx: WriteContext = {
    paperTitle: paper.title,
    sectionTitle: section.title,
    otherSections: paper.sections
      .filter(s => s.id !== sectionId && s.content)
      .map(s => ({ title: s.title, content: s.content })),
    sources: sources.map(s => ({ name: s.name, text: s.text })),
    intent: intentProvider(),
  }

  const messages = buildSectionMessages(ctx)

  updateSection(sectionId, { status: 'writing', content: '' })

  const opts: ChatOptions = {
    numCtx: WRITER_NUM_CTX,
    temperature: 0.6,
    keepAlive: '10m',
  }
  if (model.thinking) opts.think = false

  try {
    await chatStream(
      model.tag,
      messages,
      (_token, full) => {
        const content = model.stripThink ? stripThinking(full) : full
        updateSection(sectionId, { content })
      },
      opts,
      signal,
    )
    // Covers both normal completion and an aborted stream (chatStream resolves rather
    // than throwing on AbortError), matching the "keep partial text, end 'done'" contract.
    updateSection(sectionId, { status: 'done' })
  } catch (e) {
    updateSection(sectionId, { status: 'done' })
    throw e
  }
}
