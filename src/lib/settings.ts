import { useSyncExternalStore } from 'react'
import type { Quant } from './hardware'

export interface AppSettings {
  setupDone: boolean
  ocrQuant: Quant | null
  ocrTag: string | null
}

const STORAGE_KEY = 'papertiger.settings'

const DEFAULT_SETTINGS: AppSettings = {
  setupDone: false,
  ocrQuant: null,
  ocrTag: null,
}

type Listener = () => void
const listeners = new Set<Listener>()

function safeParse(raw: string | null): AppSettings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// useSyncExternalStore requires a referentially stable snapshot: only build a new
// object when the stored string actually changes, otherwise React re-renders forever.
let cachedRaw: string | null | undefined
let cachedSettings: AppSettings = DEFAULT_SETTINGS

export function readSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedSettings = safeParse(raw)
  }
  return cachedSettings
}

export function updateSettings(patch: Partial<AppSettings>): void {
  const next = { ...readSettings(), ...patch }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS)
}
