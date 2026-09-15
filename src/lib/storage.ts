import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri'

const STORAGE_PREFIX = 'papertiger.data.'

/** Loads a JSON-serialisable value previously saved under `name`, or null if absent/invalid. */
export async function loadJson<T>(name: string): Promise<T | null> {
  if (isTauri()) {
    const raw = await invoke<string | null>('load_app_data', { name })
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_PREFIX + name)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Persists a JSON-serialisable value under `name` (Tauri: app data dir; browser: localStorage). */
export async function saveJson(name: string, value: unknown): Promise<void> {
  const contents = JSON.stringify(value)

  if (isTauri()) {
    await invoke('save_app_data', { name, contents })
    return
  }

  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + name, contents)
  } catch (e) {
    console.warn(`papertiger: failed to save "${name}" to localStorage`, e)
  }
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Debounces saveJson so rapid successive writes to the same `name` collapse into one. */
export function saveJsonDebounced(name: string, getValue: () => unknown, ms = 400): void {
  const existing = debounceTimers.get(name)
  if (existing) clearTimeout(existing)

  debounceTimers.set(
    name,
    setTimeout(() => {
      debounceTimers.delete(name)
      void saveJson(name, getValue())
    }, ms),
  )
}
