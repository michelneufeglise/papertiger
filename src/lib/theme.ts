import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'papertiger.theme'

function prefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveIsDark(mode: ThemeMode): boolean {
  return mode === 'system' ? prefersDark() : mode === 'dark'
}

/** Reads the persisted theme choice, falling back to 'system'. */
export function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

/**
 * Applies a theme mode to <html> by setting exactly one of `dark` / `light`.
 * Safe to call outside React (e.g. once at app start to avoid a flash).
 */
export function applyTheme(mode: ThemeMode): boolean {
  const html = document.documentElement
  const isDark = resolveIsDark(mode)
  if (isDark) {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }
  return isDark
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(mode))

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    setIsDark(applyTheme(next))
  }, [])

  // While in Auto, follow the OS setting live.
  useEffect(() => {
    if (mode !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setIsDark(applyTheme('system'))
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [mode])

  return { mode, setMode, isDark }
}
