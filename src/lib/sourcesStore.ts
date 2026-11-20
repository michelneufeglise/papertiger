import { useSyncExternalStore } from 'react'
import type { Source, SourceInput, SourceKind } from './sources'
import { processSource } from './sources'
import { readSettings, subscribeSettings } from './settings'
import { unloadModel } from './ollama'
import { loadJson, saveJsonDebounced } from './storage'

// External store with a cached snapshot (same pattern as settings.ts / paper.ts): `state`
// is only ever reassigned (never mutated in place), so it stays referentially stable
// between renders unless something actually changed — required for useSyncExternalStore
// to avoid an infinite render loop. Persisted under the 'sources' key (see persist() below);
// in-flight statuses are collapsed to 'queued' on save and resumed (or dropped) on hydrate.
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

// --- Persistence -----------------------------------------------------------
//
// Sources persist across launches so extracted text survives a reload. `text`
// can be large and OCR streams progress frequently, so saves are debounced
// (saveJsonDebounced's default 400ms) rather than firing on every update.

type PersistedStatus = 'done' | 'error' | 'queued'

interface PersistedSource {
  id: string
  name: string
  kind: SourceKind
  sizeBytes: number
  addedAt: string
  status: PersistedStatus
  pages: number
  text: string
  error?: string
  note?: string
  path?: string
}

interface PersistedSources {
  version: 1
  sources: PersistedSource[]
}

const SOURCES_STORAGE_KEY = 'sources'

function collapseStatus(status: Source['status']): PersistedStatus {
  if (status === 'done' || status === 'error') return status
  return 'queued'
}

function toPersisted(source: Source): PersistedSource {
  const persisted: PersistedSource = {
    id: source.id,
    name: source.name,
    kind: source.kind,
    sizeBytes: source.sizeBytes,
    addedAt: source.addedAt.toISOString(),
    status: collapseStatus(source.status),
    pages: source.pages,
    text: source.text,
  }
  if (source.error !== undefined) persisted.error = source.error
  if (source.path !== undefined) persisted.path = source.path
  if (source.note !== undefined) persisted.note = source.note
  return persisted
}

function persist(): void {
  saveJsonDebounced(SOURCES_STORAGE_KEY, (): PersistedSources => ({
    version: 1,
    sources: state.map(toPersisted),
  }))
}

/**
 * Restores sources saved by a previous session. Done/error sources come back as-is; a
 * queued source with a `path` (Tauri) is re-enqueued for processing, one without a path
 * (a browser File that can't be recovered) is dropped. No-op if the store already has
 * sources (e.g. hydrate was already called, or something added a source first).
 */
export async function hydrateSources(): Promise<void> {
  if (state.length > 0) return

  const loaded = await loadJson<PersistedSources>(SOURCES_STORAGE_KEY)
  if (!loaded || !Array.isArray(loaded.sources) || loaded.sources.length === 0) return

  const restored: Source[] = []
  const toEnqueue: { id: string; path: string }[] = []

  for (const p of loaded.sources) {
    if (p.status === 'queued' && !p.path) continue // can't recover a browser File across reloads

    const source: Source = {
      id: p.id,
      name: p.name,
      kind: p.kind,
      sizeBytes: p.sizeBytes,
      addedAt: new Date(p.addedAt),
      status: p.status,
      progress: { page: p.status === 'done' ? p.pages : 0, pages: p.pages },
      pages: p.pages,
      text: p.text,
      error: p.error,
      note: p.note,
      path: p.path,
    }
    restored.push(source)
    if (p.status === 'queued' && p.path) toEnqueue.push({ id: p.id, path: p.path })
  }

  if (restored.length === 0) return

  state = restored
  notify()

  for (const item of toEnqueue) enqueue(item.id, { path: item.path })
}

export function addSource(source: Source): void {
  state = [source, ...state]
  notify()
  persist()
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
  persist()
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
  persist()
  runQueue()
}

// --- Sequential processing queue -----------------------------------------
//
// Kept at module scope (not in a React component) so a source keeps processing
// even if the user navigates away from the Sources screen. Reads
// `readSettings().ocrTag` at run time on every queue check: sources whose kind
// needs OCR (pdf/image) sit in 'queued' while no OCR model is configured and
// are (re)started as soon as one is (via the settings subscription below).
// Text-native documents (docx and every other non-OCR kind) don't need OCR and process
// immediately and in parallel.

const inputs: Record<string, SourceInput> = {}
let processingOrder: string[] = []
const abortControllers: Record<string, AbortController> = {}
let processingId: string | null = null
// True once the OCR model has actually been called since it was last unloaded
// (digital PDFs read from their text layer never load it).
let ocrRan = false

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
    if (!usesOcr) continue // handled by startTextProcessing
    if (!ocrTag) continue
    return { id, ocrTag, usesOcr }
  }
  return null
}

function runQueue(): void {
  // Text-native documents never touch the OCR model and are quick, so they start right away
  // instead of waiting behind a long OCR job.
  for (const id of processingOrder) {
    const source = state.find(s => s.id === id)
    if (!source || source.status !== 'queued' || needsOcr(source.kind) || startedText.has(id)) continue
    startedText.add(id)
    void startTextProcessing(id)
  }
  if (processingId) return
  const next = findRunnable()
  if (!next) return
  void startProcessing(next.id, next.ocrTag ?? '', next.usesOcr)
}

const startedText = new Set<string>()

async function startTextProcessing(id: string): Promise<void> {
  const input = inputs[id]
  if (!input) {
    startedText.delete(id)
    return
  }
  const controller = new AbortController()
  abortControllers[id] = controller
  await processSource(input, '', patch => updateSource(id, patch), controller.signal)
  delete abortControllers[id]
  startedText.delete(id)
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

  const { usedOcr } = await processSource(input, ocrTag, patch => updateSource(id, patch), controller.signal)
  if (usedOcr) ocrRan = true

  delete abortControllers[id]
  processingId = null

  const next = findRunnable()
  if (next) {
    runQueue()
  } else if (usesOcr && ocrRan) {
    // The queue has drained of OCR work — free the memory for the writer.
    ocrRan = false
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
