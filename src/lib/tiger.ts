import { useEffect, useSyncExternalStore } from 'react'
import { useChat } from './chat'
import { usePaper } from './paper'
import { useSources } from './sourcesStore'

/** Reading order of the 6x6 sheet in design/tiger-emotions-sheet.jpg. */
export const TIGER_STATES = [
  'idle', 'listening', 'thinking', 'talking', 'happy', 'sad',
  'surprised', 'laughing', 'shy', 'sleeping', 'bored', 'angry',
  'scared', 'excited', 'disgusted', 'confused', 'cheerful', 'frustrated',
  'sick', 'shocked', 'anxious', 'proud', 'doubtful', 'lazy',
  'sad-hello', 'waving-bye', 'cuddly', 'thirsty', 'busy', 'spooked',
  'nervous', 'hopeful', 'chilling', 'wonder', 'writing', 'reading',
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

export function tigerSrc(state: TigerState): string {
  return SPRITES[state]
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
  img.src = SPRITES[TIGER_STATES[i % TIGER_STATES.length]] ?? ''
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
// Mood: a pinned state derived from the existing stores.
// ---------------------------------------------------------------------------

const SAD_MS = 4000
let sadActive = false
const sadListeners = new Set<() => void>()
const sadSubscribe = (l: () => void) => {
  sadListeners.add(l)
  return () => sadListeners.delete(l)
}
const sadSnapshot = () => sadActive
let lastErrorIds: string | null = null

/** Pinned tiger state for what the app is doing right now, or null when idle. */
export function useTigerMood(): TigerState | null {
  const messages = useChat()
  const paper = usePaper()
  const sources = useSources()
  const sad = useSyncExternalStore(sadSubscribe, sadSnapshot, sadSnapshot)

  const errorIds = sources.filter(s => s.status === 'error').map(s => s.id).join(',')
  useEffect(() => {
    if (lastErrorIds === null) {
      lastErrorIds = errorIds // errors restored at launch are not "new"
      return
    }
    if (errorIds === lastErrorIds) return
    const prev = new Set(lastErrorIds.split(',').filter(Boolean))
    const fresh = errorIds.split(',').filter(id => id && !prev.has(id))
    lastErrorIds = errorIds
    if (fresh.length === 0) return
    sadActive = true
    sadListeners.forEach(l => l())
    setTimeout(() => {
      sadActive = false
      sadListeners.forEach(l => l())
    }, SAD_MS)
  }, [errorIds])

  if (paper.sections.some(s => s.status === 'writing')) return 'writing'

  const last = messages[messages.length - 1]
  if (last) {
    if (last.role === 'assistant' && last.streaming) return 'talking'
    if (last.role === 'user') return 'thinking'
  }

  if (sources.some(s => s.status === 'extracting' || s.status === 'rendering')) return 'reading'
  if (sad) return 'sad'
  return null
}
