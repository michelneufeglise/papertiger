import { useSyncExternalStore } from 'react'
import type { Source, SourceInput } from './sources'
import { processSource } from './sources'
import { readSettings, subscribeSettings } from './settings'
import { unloadModel } from './ollama'

// External store with a cached snapshot (same pattern as settings.ts / paper.ts): `state`
// is only ever reassigned (never mutated in place), so it stays referentially stable
// between renders unless something actually changed — required for useSyncExternalStore
// to avoid an infinite render loop. Not persisted: sources are re-added per session.
let state: Source[] = []

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Source[] {
  return state
}

export function getSources(): Source[] {
  return state
}

export function useSources(): Source[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function addSource(source: Source): void {
  state = [source, ...state]
  notify()
}

export function updateSource(id: string, patch: Partial<Source>): void {
  let changed = false
  const next = state.map(source => {
    if (source.id !== id) return source
    changed = true
    return { ...source, ...patch }
  })
  if (!changed) return
  state = next
  notify()
}

export function removeSource(id: string): void {
  abortControllers[id]?.abort()
  delete abortControllers[id]
  delete inputs[id]
  processingOrder = processingOrder.filter(pid => pid !== id)

  const next = state.filter(source => source.id !== id)
  if (next.length === state.length) return
  state = next
  notify()
  runQueue()
}

// --- Sequential processing queue -----------------------------------------
//
// Kept at module scope (not in a React component) so a source keeps processing
// even if the user navigates away from the Sources screen. Reads
// `readSettings().ocrTag` at run time on every queue check: sources whose kind
// needs OCR (pdf/image) sit in 'queued' while no OCR model is configured and
// are (re)started as soon as one is (via the settings subscription below).
// DOCX sources don't need OCR and process regardless.

const inputs: Record<string, SourceInput> = {}
let processingOrder: string[] = []
const abortControllers: Record<string, AbortController> = {}
let processingId: string | null = null

function needsOcr(kind: Source['kind']): boolean {
  return kind === 'pdf' || kind === 'image'
}

interface RunnableSource {
  id: string
  ocrTag: string | null
  usesOcr: boolean
}

function findRunnable(): RunnableSource | null {
  const ocrTag = readSettings().ocrTag
  for (const id of processingOrder) {
    const source = state.find(s => s.id === id)
    if (!source || source.status !== 'queued') continue
    const usesOcr = needsOcr(source.kind)
    if (usesOcr && !ocrTag) continue
    return { id, ocrTag, usesOcr }
  }
  return null
}

function runQueue(): void {
  if (processingId) return
  const next = findRunnable()
  if (!next) return
  void startProcessing(next.id, next.ocrTag ?? '', next.usesOcr)
}

async function startProcessing(id: string, ocrTag: string, usesOcr: boolean): Promise<void> {
  const input = inputs[id]
  if (!input) {
    runQueue()
    return
  }

  processingId = id
  const controller = new AbortController()
  abortControllers[id] = controller

  await processSource(input, ocrTag, patch => updateSource(id, patch), controller.signal)

  delete abortControllers[id]
  processingId = null

  const next = findRunnable()
  if (next) {
    runQueue()
  } else if (usesOcr) {
    // The queue has drained of OCR work — free the memory for the writer.
    const currentTag = readSettings().ocrTag
    if (currentTag) void unloadModel(currentTag)
  }
}

export function enqueue(id: string, input: SourceInput): void {
  inputs[id] = input
  if (!processingOrder.includes(id)) processingOrder = [...processingOrder, id]
  runQueue()
}

export function cancel(id: string): void {
  abortControllers[id]?.abort()
}

// Re-check the queue whenever settings change (in particular, when an OCR model
// is chosen) so sources that were waiting on `ocrTag` start automatically.
subscribeSettings(() => runQueue())
