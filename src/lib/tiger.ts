import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useChat } from './chat'
import { usePaper } from './paper'
import { useSources } from './sourcesStore'
import { useHumanize } from './humanizeStore'
import type { Source } from './sources'

/** Reading order of the 6x6 emotion sheet, then the 12 reading/writing poses. */
export const TIGER_STATES = [
  'idle', 'listening', 'thinking', 'talking', 'happy', 'sad',
  'surprised', 'laughing', 'shy', 'sleeping', 'bored', 'angry',
  'scared', 'excited', 'disgusted', 'confused', 'cheerful', 'frustrated',
  'sick', 'shocked', 'anxious', 'proud', 'doubtful', 'lazy',
  'sad-hello', 'waving-bye', 'cuddly', 'thirsty', 'busy', 'spooked',
  'nervous', 'hopeful', 'chilling', 'wonder', 'writing', 'reading',
  'opening-book', 'focused-reading', 'turning-page', 'amazed-reading',
  'sleepy-reading', 'taking-notes', 'picking-up-pencil', 'thinking-before-writing',
  'writing-intently', 'scribbling-fast', 'erasing-mistake', 'finished-page',
] as const

export type TigerState = (typeof TIGER_STATES)[number]

/** How long each tiger stays before the next one flips in. */
export const TIGER_CYCLE_MS = 5000

const urlModules = import.meta.glob('../assets/tiger/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const SPRITES: Record<string, string> = {}
for (const [path, url] of Object.entries(urlModules)) {
  const name = path.split('/').pop()!.replace(/\.webp$/, '')
  SPRITES[name] = url
}

/** Closest emotion sprite for each new pose, used while its own file is missing. */
const FALLBACK: Partial<Record<TigerState, TigerState>> = {
  'opening-book': 'reading',
  'focused-reading': 'reading',
  'turning-page': 'reading',
  'amazed-reading': 'happy',
  'sleepy-reading': 'reading',
  'taking-notes': 'writing',
  'picking-up-pencil': 'writing',
  'thinking-before-writing': 'thinking',
  'writing-intently': 'writing',
  'scribbling-fast': 'writing',
  'erasing-mistake': 'sad',
  'finished-page': 'happy',
}

export function tigerSrc(state: TigerState): string {
  return SPRITES[state] ?? SPRITES[FALLBACK[state] ?? 'idle'] ?? SPRITES.idle ?? ''
}

// ---------------------------------------------------------------------------
// One global ticker: a single module-level interval, started on the first
// subscriber and stopped when the last one leaves. Paused while hidden.
// ---------------------------------------------------------------------------

let index = 0
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function preload(i: number): void {
  const img = new Image()
  img.src = tigerSrc(TIGER_STATES[i % TIGER_STATES.length])
}

function tick(): void {
  if (typeof document !== 'undefined' && document.hidden) return
  index = (index + 1) % TIGER_STATES.length
  preload(index + 1)
  listeners.forEach(l => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timer === undefined) {
    preload(index + 1)
    timer = setInterval(tick, TIGER_CYCLE_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

// The snapshot is a primitive index, so it is referentially stable.
const getSnapshot = (): number => index

/** The state the global cycle is currently showing. */
export function useTigerCycle(): TigerState {
  const i = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return TIGER_STATES[i]
}

// ---------------------------------------------------------------------------
// Status store: ONE module-level state, written by the engine, read by every
// `<Tiger cycle>`. The snapshot is a string | null, so it is always stable.
// ---------------------------------------------------------------------------

let status: TigerState | null = null
const statusListeners = new Set<() => void>()

function statusSubscribe(l: () => void): () => void {
  statusListeners.add(l)
  return () => {
    statusListeners.delete(l)
  }
}
const statusSnapshot = (): TigerState | null => status

/** The pinned state for what the app is doing right now, or null (then the cycle shows). */
export function useTigerStatus(): TigerState | null {
  return useSyncExternalStore(statusSubscribe, statusSnapshot, statusSnapshot)
}

/** @deprecated alias kept for old imports. */
export const useTigerMood = useTigerStatus

// Inputs to the derivation. Activities are set by the engine, flashes by anyone.
type WritingAct = 'picking-up-pencil' | 'thinking-before-writing' | 'writing-intently' | 'scribbling-fast'
type ReadingAct = 'opening-book' | 'focused-reading' | 'sleepy-reading'
const act: { writing: WritingAct | null; humanize: 'picking-up-pencil' | 'erasing-mistake' | null; chat: 'talking' | 'thinking' | null; reading: ReadingAct | null } = {
  writing: null,
  humanize: null,
  chat: null,
  reading: null,
}

interface Flash {
  state: TigerState
  until: number
  prio: number
}
let flash: Flash | null = null
let flashTimer: ReturnType<typeof setTimeout> | undefined
let suppressFinishUntil = 0

/** Call before a section ends 'done' by abort/error so no finished-page flash fires. */
export function suppressFinishFlash(): void {
  suppressFinishUntil = Date.now() + 2000
}

/** Flash priority: errors beat completions, which beat the page-turn blip. */
const FLASH_PRIO: Partial<Record<TigerState, number>> = {
  'erasing-mistake': 3,
  sad: 3,
  'finished-page': 2,
  'amazed-reading': 2,
  'turning-page': 1,
}

function derive(): TigerState | null {
  if (act.writing) return act.writing
  if (act.humanize) return act.humanize
  if (act.chat === 'talking') return 'talking'
  if (act.chat === 'thinking') return 'thinking'
  if (act.reading) {
    if (flash?.state === 'turning-page' && act.reading !== 'opening-book') return 'turning-page'
    return act.reading
  }
  return flash ? flash.state : null
}

function recompute(): void {
  const next = derive()
  if (next === status) return
  status = next
  statusListeners.forEach(l => l())
}

/**
 * Show `state` for `ms` as a transient flash. A newer flash replaces an older
 * one, unless the older one is still running and has strictly higher priority
 * (so a finished-page blip can't cut an erasing-mistake short). When a flash
 * expires the status is recomputed from the live activity.
 */
export function flashTiger(state: TigerState, ms: number): void {
  const now = Date.now()
  const prio = FLASH_PRIO[state] ?? 1
  if (state === 'erasing-mistake') suppressFinishUntil = now + 2000
  if (flash && flash.until > now && flash.prio > prio) return
  flash = { state, until: now + ms, prio }
  if (flashTimer !== undefined) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flash = null
    flashTimer = undefined
    recompute()
  }, ms)
  recompute()
}

// ---------------------------------------------------------------------------
// Per-source reading poses.
// ---------------------------------------------------------------------------

const SLEEPY_MS = 45_000
const extractMarks = new Map<string, { page: number; since: number }>()

/** True when this source has sat on the same page for 45 s or more. Tracks page changes. */
function isSleepy(source: Source, now: number): boolean {
  if (source.status !== 'extracting') {
    extractMarks.delete(source.id)
    return false
  }
  const page = source.progress.page
  const mark = extractMarks.get(source.id)
  if (!mark || mark.page !== page) {
    extractMarks.set(source.id, { page, since: now })
    return false
  }
  return now - mark.since >= SLEEPY_MS
}

/** Tiger pose for one source row, or null when it is done / queued. */
export function tigerForSource(source: Source, now: number = Date.now()): TigerState | null {
  switch (source.status) {
    case 'rendering':
      return 'opening-book'
    case 'extracting':
      return isSleepy(source, now) ? 'sleepy-reading' : 'focused-reading'
    case 'error':
      return 'sad'
    default:
      extractMarks.delete(source.id)
      return null
  }
}

// ---------------------------------------------------------------------------
// The engine. Mount once (App.tsx). Idle = no interval.
// ---------------------------------------------------------------------------

const FAST_CPS = 40
const WINDOW_MS = 2000
const PENCIL_MS = 2000
const POLL_MS = 500

interface WriteTrack {
  start: number
  samples: { t: number; len: number }[]
  fast: boolean
}

export function useTigerStatusEngine(): void {
  const messages = useChat()
  const paper = usePaper()
  const sources = useSources()
  const humanize = useHumanize()
  const latest = useRef({ messages, paper, sources, humanize })
  const prevHumanize = useRef<Map<string, string> | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const evalRef = useRef<() => void>(() => {})
  const tracks = useRef(new Map<string, WriteTrack>())
  const seedMsgIds = useRef<Set<string> | null>(null)
  const prevSection = useRef<Map<string, string> | null>(null)
  const prevSource = useRef(new Map<string, { status: string; page: number }>())

  const evaluate = () => {
    const { messages, paper, sources, humanize } = latest.current
    const now = Date.now()

    // Writing
    let writing: WritingAct | null = null
    const live = new Set<string>()
    for (const s of paper.sections) {
      if (s.status !== 'writing') continue
      live.add(s.id)
      let tr = tracks.current.get(s.id)
      if (!tr) {
        tr = { start: now, samples: [], fast: false }
        tracks.current.set(s.id, tr)
      }
      const len = s.content.length
      tr.samples.push({ t: now, len })
      // keep one sample at/just before the window start as the baseline
      while (tr.samples.length > 1 && tr.samples[1].t <= now - WINDOW_MS) tr.samples.shift()
      const base = tr.samples[0]
      if (now - base.t >= 300) tr.fast = ((len - base.len) * 1000) / (now - base.t) >= FAST_CPS
      if (writing) continue
      if (len === 0) {
        writing = now - tr.start < PENCIL_MS ? 'picking-up-pencil' : 'thinking-before-writing'
        // restart the rate window once text begins
      } else {
        writing = tr.fast ? 'scribbling-fast' : 'writing-intently'
      }
    }
    for (const id of [...tracks.current.keys()]) if (!live.has(id)) tracks.current.delete(id)

    // writing -> done flashes
    const prev = prevSection.current
    const nextPrev = new Map(paper.sections.map(s => [s.id, s.status as string]))
    if (prev) {
      for (const s of paper.sections) {
        if (prev.get(s.id) === 'writing' && s.status === 'done' && now > suppressFinishUntil) {
          flashTiger('finished-page', 4000)
        }
      }
    }
    prevSection.current = nextPrev

    // Chat (messages present at the first evaluation are history, not live)
    if (!seedMsgIds.current) seedMsgIds.current = new Set(messages.map(m => m.id))
    const last = messages[messages.length - 1]
    let chat: 'talking' | 'thinking' | null = null
    if (last) {
      if (last.role === 'assistant' && last.streaming) chat = 'talking'
      else if (last.role === 'user' && !seedMsgIds.current?.has(last.id)) chat = 'thinking'
    }

    // Sources
    let reading: ReadingAct | null = null
    let anyExtracting = false
    let anySleepy = false
    let anyRendering = false
    const seen = prevSource.current
    for (const s of sources) {
      const before = seen.get(s.id)
      const page = s.progress.page
      if (before) {
        if (s.status === 'extracting' && page > before.page) flashTiger('turning-page', 1500)
        if (before.status !== s.status) {
          if (s.status === 'done') flashTiger('amazed-reading', 4000)
          else if (s.status === 'error') flashTiger('sad', 4000)
        }
      }
      seen.set(s.id, { status: s.status, page })
      if (s.status === 'rendering') anyRendering = true
      if (s.status === 'extracting') {
        anyExtracting = true
        if (isSleepy(s, now)) anySleepy = true
      } else extractMarks.delete(s.id)
    }
    for (const id of [...seen.keys()]) if (!sources.some(s => s.id === id)) seen.delete(id)
    if (anyRendering) reading = 'opening-book'
    else if (anyExtracting) reading = anySleepy ? 'sleepy-reading' : 'focused-reading'

    // Humanize: pencil before the first token of a block, then the eraser while reworking.
    const running = humanize.runningId ? humanize.jobs[humanize.runningId] : undefined
    const hum: 'picking-up-pencil' | 'erasing-mistake' | null = running
      ? running.draft.length === 0
        ? 'picking-up-pencil'
        : 'erasing-mistake'
      : null
    // Per-document flash when a job goes running -> done (nothing for cancelled or error).
    const prevH = prevHumanize.current
    const nextH = new Map(Object.values(humanize.jobs).map(j => [j.sourceId, j.status as string]))
    if (prevH) {
      for (const j of Object.values(humanize.jobs)) {
        if (prevH.get(j.sourceId) === 'running' && j.status === 'done') {
          flashTiger(j.flagged.length > 0 ? 'sad' : 'finished-page', 4000)
        }
      }
    }
    prevHumanize.current = nextH

    act.writing = writing
    act.humanize = hum
    act.chat = chat
    act.reading = reading
    recompute()

    // Poll only while something time-based is active.
    const needPoll = writing !== null || anyExtracting
    if (needPoll && interval.current === undefined) {
      interval.current = setInterval(() => evalRef.current(), POLL_MS)
    } else if (!needPoll && interval.current !== undefined) {
      clearInterval(interval.current)
      interval.current = undefined
    }
  }

  useEffect(() => {
    evalRef.current = evaluate
    latest.current = { messages, paper, sources, humanize }
    evalRef.current()
  }, [messages, paper, sources, humanize])

  useEffect(
    () => () => {
      if (interval.current !== undefined) clearInterval(interval.current)
      interval.current = undefined
    },
    [],
  )
}

const STATUS_LABELS: Partial<Record<TigerState, string>> = {
  thinking: 'Thinking',
  talking: 'Replying',
  'opening-book': 'Opening a source',
  'focused-reading': 'Reading',
  'sleepy-reading': 'Still reading…',
  'turning-page': 'Next page',
  'amazed-reading': 'Source read!',
  'taking-notes': 'Ready for sources',
  'picking-up-pencil': 'Getting ready to write',
  'thinking-before-writing': 'Thinking it over',
  'writing-intently': 'Writing',
  'scribbling-fast': 'Writing fast',
  'erasing-mistake': 'Fixing a mistake',
  'finished-page': 'Page done!',
  sad: 'Something went wrong',
}

/** Human-readable label for a pose: friendly wording for status poses, else the capitalised name. */
export function tigerLabel(state: TigerState): string {
  const friendly = STATUS_LABELS[state]
  if (friendly) return friendly
  const name = state.replace(/-/g, ' ')
  return name.charAt(0).toUpperCase() + name.slice(1)
}
