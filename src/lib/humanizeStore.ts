import { useSyncExternalStore } from 'react'
import { getSources } from './sourcesStore'
import { readSettings } from './settings'
import { OllamaError } from './ollama'
import { runHumanize, type FlaggedBlock, type HumanizeEvent } from './humanize/run'
import type { Block } from './humanize/segment'
import type { Strength, Tone } from './humanize/prompts'

export type { Strength, Tone } from './humanize/prompts'
export type { FlaggedBlock } from './humanize/run'

export type HumanizePhase = 'idle' | 'segmented' | 'block' | 'done' | 'cancelled' | 'error'
export type JobStatus = 'queued' | 'running' | 'done' | 'cancelled' | 'error'

/** A manual-review decision for one block. An absent decision means "keep the rewrite". */
export type Decision = { kind: 'revert' } | { kind: 'edit'; text: string }

export interface DocJob {
  sourceId: string
  /** Source name without extension; used as the document title and the .docx name. */
  title: string
  status: JobStatus
  phase: HumanizePhase
  /** 1-based number of the block being rewritten (0 before the first). */
  i: number
  /** Number of blocks that will be rewritten. */
  of: number
  blocks: Block[]
  /** The model's accepted text per block idx (flagged blocks hold the original text). */
  rewrites: Record<number, string>
  /** Last rewrite the quality guard refused, per flagged block idx. */
  rejected: Record<number, string>
  /** Manual-review decisions per block idx. */
  decisions: Record<number, Decision>
  /** idx of the block being written, or null. */
  currentIdx: number | null
  /** Live tokens of the block being written (not final). */
  draft: string
  flagged: FlaggedBlock[]
  model: string | null
  language: string | null
  strength: Strength
  startedAt: number | null
  /** Set when the job ends (done / cancelled / error). */
  finishedAt: number | null
  tokPerSec: number
  error: string | null
}

export interface HumanizeState {
  tone: Tone
  strength: Strength
  manualReview: boolean
  /** Source ids, in the order they were picked. */
  selected: string[]
  jobs: Record<string, DocJob>
  /** Job ids in display order. */
  order: string[]
  runningId: string | null
  /** Store-level error (no run happened), e.g. no writer model. */
  error: string | null
}

const INITIAL: HumanizeState = {
  tone: 'natural',
  strength: 'medium',
  manualReview: false,
  selected: [],
  jobs: {},
  order: [],
  runningId: null,
  error: null,
}

// External store with a cached snapshot: `state` is only reassigned (never mutated), so it
// stays referentially stable between renders unless something changed. In memory only.
let state: HumanizeState = INITIAL

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  for (const l of listeners) l()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setState(patch: Partial<HumanizeState>): void {
  state = { ...state, ...patch }
  notify()
}

function setJob(id: string, patch: Partial<DocJob>): void {
  const job = state.jobs[id]
  if (!job) return
  state = { ...state, jobs: { ...state.jobs, [id]: { ...job, ...patch } } }
  notify()
}

export function getHumanize(): HumanizeState {
  return state
}

export function useHumanize(): HumanizeState {
  return useSyncExternalStore(subscribe, getHumanize, getHumanize)
}

// --- Derived ---------------------------------------------------------------------------

// Memoized per (rewrites, decisions) pair so the result stays referentially stable while
// only other job fields (draft, progress) change.
const effectiveCache = new WeakMap<object, WeakMap<object, Record<number, string>>>()

/** Flagged blocks the user has not yet reviewed (no decision). */
export function unresolvedFlags(job: DocJob): FlaggedBlock[] {
  return job.flagged.filter(f => !job.decisions[f.idx])
}

/**
 * The rewrites with the review decisions applied: keep = rewrite, revert = no entry (render
 * falls back to the original), edit = the user's text (also valid for flagged blocks, as
 * "use rewrite anyway").
 */
export function effectiveOutputs(job: DocJob): Record<number, string> {
  let byDecisions = effectiveCache.get(job.rewrites)
  if (!byDecisions) {
    byDecisions = new WeakMap()
    effectiveCache.set(job.rewrites, byDecisions)
  }
  const hit = byDecisions.get(job.decisions)
  if (hit) return hit
  const out: Record<number, string> = {}
  for (const [k, text] of Object.entries(job.rewrites)) {
    const idx = Number(k)
    const d = job.decisions[idx]
    if (!d) out[idx] = text
    else if (d.kind === 'edit') out[idx] = d.text
  }
  for (const [k, d] of Object.entries(job.decisions)) {
    if (d.kind === 'edit') out[Number(k)] = d.text
  }
  byDecisions.set(job.decisions, out)
  return out
}

// --- Settings & selection --------------------------------------------------------------

export function setTone(tone: Tone): void {
  if (state.tone !== tone) setState({ tone })
}

export function setStrength(strength: Strength): void {
  if (state.strength !== strength) setState({ strength })
}

export function setManualReview(manualReview: boolean): void {
  if (state.manualReview !== manualReview) setState({ manualReview })
}

export function toggleSelected(id: string): void {
  setState({
    selected: state.selected.includes(id) ? state.selected.filter((s) => s !== id) : [...state.selected, id],
  })
}

/** Selects every source that finished extraction and has text. */
export function selectAll(): void {
  setState({ selected: getSources().filter((s) => s.status === 'done' && s.text.trim()).map((s) => s.id) })
}

export function clearSelection(): void {
  if (state.selected.length) setState({ selected: [] })
}

// --- Review decisions ------------------------------------------------------------------

/** Sets (or, with null, clears) the decision for one block. */
export function setDecision(sourceId: string, idx: number, decision: Decision | null): void {
  const job = state.jobs[sourceId]
  if (!job) return
  const decisions = { ...job.decisions }
  if (decision) decisions[idx] = decision
  else delete decisions[idx]
  setJob(sourceId, { decisions })
}

/** Keeps every rewrite: clears all decisions. */
export function keepAll(sourceId: string): void {
  const job = state.jobs[sourceId]
  if (!job || Object.keys(job.decisions).length === 0) return
  setJob(sourceId, { decisions: {} })
}

/** Reverts every block that has a rewrite. */
export function revertAll(sourceId: string): void {
  const job = state.jobs[sourceId]
  if (!job) return
  const decisions: Record<number, Decision> = {}
  for (const k of Object.keys(job.rewrites)) decisions[Number(k)] = { kind: 'revert' }
  setJob(sourceId, { decisions })
}

// --- Batch run -------------------------------------------------------------------------

interface Batch {
  cancelled: boolean
  controller: AbortController | null
}
let batch: Batch | null = null

// Draft tokens arrive far faster than React needs them: buffer and emit at most every 50 ms.
const DRAFT_THROTTLE_MS = 50
let draftBuffer = ''
let draftTimer: ReturnType<typeof setTimeout> | null = null

function flushDraft(): void {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  const id = state.runningId
  if (id && state.jobs[id] && state.jobs[id].draft !== draftBuffer) setJob(id, { draft: draftBuffer })
}

function pushDraft(delta: string): void {
  draftBuffer += delta
  if (draftTimer === null) draftTimer = setTimeout(flushDraft, DRAFT_THROTTLE_MS)
}

function resetDraft(): void {
  draftBuffer = ''
  flushDraft()
}

function dropDraftTimer(): void {
  draftBuffer = ''
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
}

function stripExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

function errorMessage(e: unknown): string {
  if (e instanceof OllamaError || e instanceof Error) return e.message
  return 'Something went wrong while rewriting.'
}

function newJob(sourceId: string, title: string, status: JobStatus): DocJob {
  return {
    sourceId,
    title,
    status,
    phase: 'idle',
    i: 0,
    of: 0,
    blocks: [],
    rewrites: {},
    rejected: {},
    decisions: {},
    currentIdx: null,
    draft: '',
    flagged: [],
    model: null,
    language: null,
    strength: state.strength,
    startedAt: null,
    finishedAt: null,
    tokPerSec: 0,
    error: null,
  }
}

function handleEvent(b: Batch, id: string, e: HumanizeEvent): void {
  if (b.cancelled) return
  const job = state.jobs[id]
  if (!job) return
  switch (e.type) {
    case 'segmented':
      setJob(id, { phase: 'segmented', of: e.of, blocks: e.blocks, language: e.language, model: e.model })
      break
    case 'block':
      resetDraft()
      setJob(id, { phase: 'block', i: e.i, of: e.of, currentIdx: e.idx })
      break
    case 'draft':
      pushDraft(e.delta)
      break
    case 'draftReset':
      resetDraft()
      break
    case 'output':
      setJob(id, { rewrites: { ...job.rewrites, [e.idx]: e.text } })
      break
    case 'flag':
      setJob(id, {
        flagged: [...job.flagged, e.flag],
        rejected: { ...job.rejected, [e.flag.idx]: e.flag.rejected },
      })
      break
    case 'stats':
    case 'done':
      setJob(id, { tokPerSec: e.stats.tokPerSec })
      break
  }
}

async function runJob(b: Batch, id: string, model: string): Promise<void> {
  const source = getSources().find((s) => s.id === id && s.status === 'done')
  if (!source || !source.text.trim()) {
    const title = state.jobs[id]?.title || 'Missing document'
    setJob(id, {
      title,
      status: 'error',
      phase: 'error',
      finishedAt: Date.now(),
      error: source ? 'This source has no extracted text to rewrite.' : 'This source is no longer available.',
    })
    return
  }
  const title = stripExtension(source.name)
  const controller = new AbortController()
  b.controller = controller
  dropDraftTimer()
  state = { ...state, runningId: id }
  setJob(id, { ...newJob(id, title, 'running'), model, startedAt: Date.now() })

  try {
    const result = await runHumanize(
      source.text,
      title,
      { tone: state.tone, strength: state.strength, model, signal: controller.signal },
      (e) => handleEvent(b, id, e),
    )
    if (b.cancelled) return
    resetDraft()
    if (result.cancelled) {
      setJob(id, { status: 'cancelled', phase: 'cancelled', currentIdx: null, finishedAt: Date.now() })
    } else if (result.stats.calls === 0) {
      setJob(id, {
        status: 'error',
        phase: 'error',
        currentIdx: null,
        finishedAt: Date.now(),
        error: 'Nothing to rewrite in this document.',
      })
    } else {
      setJob(id, { status: 'done', phase: 'done', currentIdx: null, finishedAt: Date.now() })
    }
  } catch (e) {
    if (b.cancelled) return
    resetDraft()
    setJob(id, { status: 'error', phase: 'error', currentIdx: null, finishedAt: Date.now(), error: errorMessage(e) })
  } finally {
    if (b.controller === controller) b.controller = null
  }
}

/**
 * Humanizes the selected documents one after another with the configured writer model.
 * Ids that already have a job are re-run (their job is replaced). Ignored while a batch runs.
 */
export async function startBatch(): Promise<void> {
  if (batch) return
  // Same rule as the screen's doneSources: the source exists, is done and has text.
  const usable = new Set(getSources().filter((s) => s.status === 'done' && s.text.trim()).map((s) => s.id))
  const ids = state.selected.filter((id) => usable.has(id))
  if (ids.length !== state.selected.length) setState({ selected: ids })
  if (ids.length === 0) return
  const model = readSettings().writerTag
  if (!model) {
    setState({ error: 'No writer model is set up.' })
    return
  }

  const b: Batch = { cancelled: false, controller: null }
  batch = b
  const jobs = { ...state.jobs }
  for (const id of ids) {
    const name = getSources().find((s) => s.id === id)?.name
    jobs[id] = newJob(id, name ? stripExtension(name) : jobs[id]?.title || '', 'queued')
  }
  setState({ jobs, order: [...ids, ...state.order.filter((o) => !ids.includes(o))], runningId: null, error: null })

  try {
    for (const id of ids) {
      if (b.cancelled) break
      await runJob(b, id, model)
    }
  } finally {
    if (batch === b) {
      batch = null
      dropDraftTimer()
      if (state.runningId !== null) setState({ runningId: null })
    }
  }
}

/**
 * Stops the batch: the running document becomes 'cancelled' (finished blocks stay in its
 * rewrites) and every queued document is marked cancelled too.
 */
export function cancelBatch(): void {
  const b = batch
  if (!b) return
  b.cancelled = true
  batch = null
  b.controller?.abort()
  dropDraftTimer()
  const jobs: Record<string, DocJob> = {}
  const now = Date.now()
  for (const [id, job] of Object.entries(state.jobs)) {
    jobs[id] =
      job.status === 'running'
        ? { ...job, status: 'cancelled', phase: 'cancelled', currentIdx: null, draft: '', finishedAt: now }
        : job.status === 'queued'
          ? { ...job, status: 'cancelled', phase: 'cancelled', finishedAt: now }
          : job
  }
  setState({ jobs, runningId: null })
}

/** Removes every job (keeps the selection and settings). Ignored while a batch runs. */
export function clearJobs(): void {
  if (batch) return
  setState({ jobs: {}, order: [], runningId: null, error: null })
}
