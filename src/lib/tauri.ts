/** True when running inside the Tauri shell (vs. the plain-Vite browser preview). */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
