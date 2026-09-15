import { useSyncExternalStore } from 'react'
import { loadJson, saveJsonDebounced } from './storage'

export interface VoiceTunings {
  formality: number
  conciseness: number
  technicality: number
}

export const DEFAULT_TUNINGS: VoiceTunings = { formality: 7, conciseness: 6, technicality: 8 }

// External store with a cached snapshot (same pattern as settings.ts / paper.ts): `state`
// is only ever reassigned (never mutated in place), so it stays referentially stable
// between renders unless something actually changed — required for useSyncExternalStore
// to avoid an infinite render loop.
let state: VoiceTunings = { ...DEFAULT_TUNINGS }

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): VoiceTunings {
  return state
}

export function getVoice(): VoiceTunings {
  return state
}

export function useVoice(): VoiceTunings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function clamp(value: number): number {
  return Math.min(10, Math.max(1, value))
}

export function setTuning(key: keyof VoiceTunings, value: number): void {
  const clamped = clamp(value)
  if (state[key] === clamped) return
  state = { ...state, [key]: clamped }
  notify()
  saveJsonDebounced('voice', () => state)
}

/** Loads persisted tunings and applies them to the store. Call once at app start. */
export async function hydrateVoice(): Promise<void> {
  const loaded = await loadJson<Partial<VoiceTunings>>('voice')
  if (!loaded) return
  state = { ...DEFAULT_TUNINGS, ...loaded }
  notify()
}

type Band = 'low' | 'mid' | 'high'

function band(value: number): Band {
  if (value <= 3) return 'low'
  if (value <= 7) return 'mid'
  return 'high'
}

const FORMALITY: Record<Band, string> = {
  low: 'Use a conversational register; contractions are fine.',
  mid: 'Use a measured academic register.',
  high: 'Use a formal academic register; no contractions, no first person.',
}

const CONCISENESS: Record<Band, string> = {
  low: 'Develop points fully with supporting detail.',
  mid: 'Keep paragraphs focused; one idea per paragraph.',
  high: 'Be concise: short sentences, no filler, no repetition.',
}

const TECHNICALITY: Record<Band, string> = {
  low: 'Prefer plain language; explain any technical term.',
  mid: 'Use domain terminology where it is precise, briefly defined on first use.',
  high: 'Use precise domain terminology and standard notation without simplification.',
}

export function describeVoice(t: VoiceTunings): string[] {
  return [
    FORMALITY[band(t.formality)],
    CONCISENESS[band(t.conciseness)],
    TECHNICALITY[band(t.technicality)],
  ]
}
