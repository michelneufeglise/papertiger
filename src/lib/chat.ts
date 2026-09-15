import { useSyncExternalStore } from 'react'
import { mockMessages, getRandomAssistantReply } from '../mock/messages'
import { getPaper, generateSection } from './paper'
import { getSources } from './sourcesStore'
import { isWriterConfigured, readSettings } from './settings'
import { chatStream, getStatus, stripThinking } from './ollama'
import type { OllamaChatMessage } from './ollama'
import { WRITER_NUM_CTX, writerById } from './models'
import { setIntentProvider } from './writer'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

const WRITE_RE = /\b(write|draft)\b/i
const HISTORY_LIMIT = 12
const INTENT_LIMIT = 6
const CANNED_REPLY_DELAY_MS = 800

const SYSTEM_PROMPT_BASE =
  "You are papertiger, an academic writing assistant running fully on this Mac. You know the paper " +
  "title, its sections and which are still empty, and the user's sources by name. Answer briefly. " +
  'When the user asks you to write or draft a section, reply with one short sentence and the app ' +
  'will draft it in the panel.'

// External store with a cached snapshot (same pattern as paper.ts / settings.ts): `state`
// is only ever reassigned (never mutated in place), so it stays referentially stable
// between renders unless something actually changed.
let state: ChatMessage[] = mockMessages.map(m => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: m.timestamp,
}))

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ChatMessage[] {
  return state
}

export function useChat(): ChatMessage[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function pushMessage(message: ChatMessage): void {
  state = [...state, message]
  notify()
}

function patchMessage(id: string, patch: Partial<ChatMessage>): void {
  let changed = false
  const next = state.map(message => {
    if (message.id !== id) return message
    changed = true
    return { ...message, ...patch }
  })
  if (!changed) return
  state = next
  notify()
}

export function clear(): void {
  state = []
  notify()
}

/** The content of the last `limit` user messages, oldest first. */
export function getUserIntent(limit = INTENT_LIMIT): string[] {
  return state
    .filter(m => m.role === 'user')
    .slice(-limit)
    .map(m => m.content)
}

// writer.ts needs recent user intent to draft a section, but must not statically import
// chat.ts (that would create a paper.ts <-> writer.ts <-> chat.ts cycle). Register the
// provider here instead, once, at module init.
setIntentProvider(() => getUserIntent(INTENT_LIMIT))

function pickTargetSectionId(content: string): string | undefined {
  const paper = getPaper()
  const lower = content.toLowerCase()
  const named = paper.sections.find(s => s.title && lower.includes(s.title.toLowerCase()))
  if (named) return named.id
  return paper.sections.find(s => s.status === 'empty')?.id
}

function buildSystemPrompt(): string {
  const paper = getPaper()
  const sectionSummary = paper.sections.map(s => `${s.title} (${s.status})`).join(', ') || 'none yet'
  const sourceNames = getSources().map(s => s.name)
  return [
    SYSTEM_PROMPT_BASE,
    '',
    `Paper title: ${paper.title || 'Untitled'}`,
    `Sections: ${sectionSummary}`,
    `Sources: ${sourceNames.length > 0 ? sourceNames.join(', ') : 'none yet'}`,
  ].join('\n')
}

async function streamAssistantReply(targetSectionId: string | undefined, wantsWriting: boolean): Promise<void> {
  const settings = readSettings()
  const model = settings.writerId ? writerById(settings.writerId) : undefined

  const history: OllamaChatMessage[] = state
    .slice(-HISTORY_LIMIT)
    .map(m => ({ role: m.role, content: m.content }))
  const messages: OllamaChatMessage[] = [{ role: 'system', content: buildSystemPrompt() }, ...history]

  const assistantId = crypto.randomUUID()
  pushMessage({ id: assistantId, role: 'assistant', content: '', timestamp: new Date(), streaming: true })

  // Kick off the section draft alongside the reply, not after it finishes streaming.
  if (wantsWriting && targetSectionId) {
    void generateSection(targetSectionId)
  }

  try {
    await chatStream(
      settings.writerTag as string,
      messages,
      (_token, full) => {
        const displayed = model?.stripThink ? stripThinking(full) : full
        patchMessage(assistantId, { content: displayed })
      },
      {
        think: model?.thinking ? false : undefined,
        numCtx: WRITER_NUM_CTX,
        temperature: 0.6,
        keepAlive: '10m',
      },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const current = state.find(m => m.id === assistantId)
    if (!current?.content) patchMessage(assistantId, { content: `Something went wrong: ${message}` })
  } finally {
    patchMessage(assistantId, { streaming: false })
  }
}

function sendCannedReply(wantsWriting: boolean, targetSectionId: string | undefined): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      pushMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: wantsWriting ? 'On it — drafting the next section on the right.' : getRandomAssistantReply(),
        timestamp: new Date(),
      })
      if (wantsWriting && targetSectionId) void generateSection(targetSectionId)
      resolve()
    }, CANNED_REPLY_DELAY_MS)
  })
}

export async function sendMessage(content: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) return

  pushMessage({ id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: new Date() })

  const wantsWriting = WRITE_RE.test(trimmed)
  const targetSectionId = wantsWriting ? pickTargetSectionId(trimmed) : undefined

  if (isWriterConfigured()) {
    const online = await getStatus()
      .then(s => s.online)
      .catch(() => false)
    if (online) {
      // A draft request goes straight to the writer. Streaming a chat reply at the same time
      // would run two generations on the same model, which halves speed on small Macs.
      if (wantsWriting && targetSectionId) {
        const title = getPaper().sections.find(s => s.id === targetSectionId)?.title ?? 'the next section'
        pushMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `On it — drafting ${title} on the right.`,
          timestamp: new Date(),
        })
        await generateSection(targetSectionId)
        return
      }
      await streamAssistantReply(targetSectionId, wantsWriting)
      return
    }
  }

  await sendCannedReply(wantsWriting, targetSectionId)
}
