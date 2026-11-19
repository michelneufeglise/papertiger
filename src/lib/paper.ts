import { useSyncExternalStore } from 'react'
import { mockPaperSections, mockPaperTitle } from '../mock/paper'
import { readSettings } from './settings'
import { writeSection } from './writer'
import { suppressFinishFlash } from './tiger'

export type SectionStatus = 'empty' | 'writing' | 'done'

export interface PaperSection {
  id: string
  title: string
  content: string
  status: SectionStatus
}

export interface Paper {
  title: string
  sections: PaperSection[]
}

const SAMPLE_GENERATED_TEXT =
  'Recent advances in machine learning have demonstrated remarkable potential in addressing complex clinical challenges. Our approach leverages state-of-the-art deep learning architectures to process multimodal patient data streams. The architectural design incorporates attention mechanisms to capture temporal dependencies and clinical significance indicators. Implementation across diverse healthcare settings has revealed consistent improvements in predictive accuracy and clinical utility. Furthermore, the model exhibits robust generalization across different patient populations and clinical contexts. Integration into existing clinical workflows requires careful consideration of alert fatigue and clinician acceptance factors.'

const CHAR_INTERVAL_MS = 15

// Abstract and Introduction start written; the rest start empty so the shimmer
// placeholders are visible on first launch.
const DONE_SECTION_IDS = new Set(['abstract', 'introduction'])

let state: Paper = {
  title: mockPaperTitle,
  sections: mockPaperSections.map(section => ({
    id: section.id,
    title: section.title,
    content: DONE_SECTION_IDS.has(section.id) ? section.content : '',
    status: DONE_SECTION_IDS.has(section.id) ? 'done' : 'empty',
  })),
}

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Returns the current paper snapshot. `state` is only ever reassigned (never
 * mutated in place), so this is referentially stable between renders unless
 * something actually changed — required for useSyncExternalStore to avoid an
 * infinite render loop.
 */
function getSnapshot(): Paper {
  return state
}

export function getPaper(): Paper {
  return state
}

export function usePaper(): Paper {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function setTitle(title: string): void {
  state = { ...state, title }
  notify()
}

export function updateSection(id: string, patch: Partial<PaperSection>): void {
  let changed = false
  const sections = state.sections.map(section => {
    if (section.id !== id) return section
    changed = true
    return { ...section, ...patch }
  })
  if (!changed) return
  state = { ...state, sections }
  notify()
}

export function wordCount(paper: Paper): number {
  return paper.sections.reduce((total, section) => {
    const words = section.content.split(/\s+/).filter(Boolean).length
    return total + words
  }, 0)
}

let isGenerating = false

/**
 * Generates a section's content. Delegates to the real writer (`writeSection`,
 * streaming from Ollama) when a writer model is configured in settings; otherwise
 * falls back to the mock character stream below. Only one generation runs at a
 * time — a second call while one is in flight resolves immediately without doing
 * anything.
 */
export function generateSection(id: string, signal?: AbortSignal): Promise<void> {
  if (isGenerating) return Promise.resolve()

  const section = state.sections.find(s => s.id === id)
  if (!section) return Promise.resolve()

  if (signal?.aborted) return Promise.resolve()

  if (readSettings().writerTag) {
    isGenerating = true
    return writeSection(id, signal).finally(() => {
      isGenerating = false
    })
  }

  return generateSectionMock(id, signal)
}

/**
 * Mock token stream: appends ~1 character every 15ms to the section's content,
 * setting status to 'writing' while running and 'done' when finished. Honours
 * an AbortSignal (stops mid-stream, keeping whatever content streamed so far and
 * setting status to 'done', like the real writer).
 */
function generateSectionMock(id: string, signal?: AbortSignal): Promise<void> {
  const section = state.sections.find(s => s.id === id)
  if (!section) return Promise.resolve()

  isGenerating = true
  const baseContent = section.content
  updateSection(id, { status: 'writing' })

  return new Promise<void>(resolve => {
    let charIndex = 0
    let intervalId: ReturnType<typeof setInterval>

    const finish = (final: boolean) => {
      clearInterval(intervalId)
      signal?.removeEventListener('abort', onAbort)
      isGenerating = false
      if (!final) suppressFinishFlash()
      updateSection(id, { status: 'done' })
      resolve()
    }

    const onAbort = () => finish(false)
    signal?.addEventListener('abort', onAbort)

    intervalId = setInterval(() => {
      charIndex++
      const streamed = SAMPLE_GENERATED_TEXT.slice(0, charIndex)
      const content = baseContent ? `${baseContent}\n\n${streamed}` : streamed
      updateSection(id, { content })

      if (charIndex >= SAMPLE_GENERATED_TEXT.length) {
        finish(true)
      }
    }, CHAR_INTERVAL_MS)
  })
}
