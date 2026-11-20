// Shared "add documents" plumbing for the Sources and Humanize screens:
// the native file dialog (or an HTML file input in the browser), native drag-drop, and the
// addSource + enqueue step.
import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { ALL_EXTENSIONS } from './extract'
import { kindFromName, type Source, type SourceInput } from './sources'
import { addSource, enqueue } from './sourcesStore'
import { isTauri } from './tauri'

export const FILE_DIALOG_EXTENSIONS: string[] = ALL_EXTENSIONS
export const FILE_INPUT_ACCEPT = FILE_DIALOG_EXTENSIONS.map(ext => `.${ext}`).join(',')

function inputName(input: SourceInput): string {
  return 'file' in input ? input.file.name : (input.path.split(/[\\/]/).pop() ?? input.path)
}

/**
 * Opens the native file dialog (Tauri) or an HTML file input (browser) and resolves with the
 * chosen files; empty when the user cancels. In the browser it must be called straight from a
 * click handler so the input may open.
 */
export function pickFiles(): Promise<SourceInput[]> {
  if (isTauri()) {
    return (async () => {
      const selected = await openFileDialog({
        multiple: true,
        filters: [{ name: 'Documents', extensions: FILE_DIALOG_EXTENSIONS }],
      })
      if (!selected) return []
      const paths = Array.isArray(selected) ? selected : [selected]
      return paths.map(path => ({ path }))
    })()
  }
  return new Promise(resolve => {
    const el = document.createElement('input')
    el.type = 'file'
    el.multiple = true
    el.accept = FILE_INPUT_ACCEPT
    el.addEventListener('change', () => resolve(Array.from(el.files ?? []).map(file => ({ file }))))
    el.addEventListener('cancel', () => resolve([]))
    el.click()
  })
}

/**
 * Adds each file as a queued source and starts extraction. Returns the ids of the sources
 * that were added; files of an unsupported type are reported through `onSkip` and left out.
 */
export async function addFiles(inputs: SourceInput[], onSkip?: (name: string) => void): Promise<string[]> {
  const ids: string[] = []
  for (const input of inputs) {
    const name = inputName(input)
    const kind = kindFromName(name)
    if (!kind) {
      onSkip?.(name)
      continue
    }

    let sizeBytes = 0
    if ('file' in input) {
      sizeBytes = input.file.size
    } else {
      try {
        sizeBytes = await invoke<number>('file_size', { path: input.path })
      } catch {
        sizeBytes = 0
      }
    }

    const id = crypto.randomUUID()
    const source: Source = {
      id,
      name,
      kind,
      sizeBytes,
      addedAt: new Date(),
      status: 'queued',
      progress: { page: 0, pages: 0 },
      pages: 0,
      text: '',
      path: 'path' in input ? input.path : undefined,
    }
    addSource(source)
    enqueue(id, input)
    ids.push(id)
  }
  return ids
}

/**
 * Drag-and-drop of files onto a screen. In Tauri the window-level native event supplies file
 * paths; in the browser the returned `dropProps` go on the drop target. `isDragOver` drives the
 * hover styling. Only one screen is mounted at a time, so each screen owns its listener.
 */
export function useFileDrop(onInputs: (inputs: SourceInput[]) => void, enabled = true) {
  const [isDragOver, setIsDragOver] = useState(false)
  const handlerRef = useRef(onInputs)
  useEffect(() => {
    handlerRef.current = onInputs
  })

  useEffect(() => {
    if (!isTauri() || !enabled) return
    let cancelled = false
    let unlisten: (() => void) | undefined
    getCurrentWebview()
      .onDragDropEvent(event => {
        const payload = event.payload
        if (payload.type === 'enter' || payload.type === 'over') setIsDragOver(true)
        else if (payload.type === 'drop') {
          setIsDragOver(false)
          handlerRef.current(payload.paths.map(path => ({ path })))
        } else if (payload.type === 'leave') setIsDragOver(false)
      })
      .then(fn => {
        if (cancelled) fn()
        else unlisten = fn
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [enabled])

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      if (isTauri() || !enabled) return
      setIsDragOver(true)
    },
    [enabled],
  )
  const onDragLeave = useCallback(() => {
    if (isTauri()) return
    setIsDragOver(false)
  }, [])
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault()
      if (isTauri() || !enabled) return
      setIsDragOver(false)
      const files = e.dataTransfer.files
      if (files && files.length > 0) handlerRef.current(Array.from(files).map(file => ({ file })))
    },
    [enabled],
  )

  return { isDragOver, dropProps: { onDragOver, onDragLeave, onDrop } }
}
