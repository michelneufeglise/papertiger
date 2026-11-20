import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { isTauri } from '../../tauri'

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Native save dialog (Tauri) or a browser download. Resolves false when the dialog was cancelled. */
export async function saveFile(
  filename: string,
  filter: { name: string; extensions: string[] },
  write: (path: string) => Promise<void>,
  browser: () => void,
): Promise<boolean> {
  if (isTauri()) {
    const path = await save({ defaultPath: filename, filters: [filter] })
    if (!path) return false
    await write(path)
    return true
  }
  browser()
  return true
}

export const writeBlob = (blob: Blob) => async (path: string) => {
  await invoke('save_file_bytes', { path, base64: await blobToBase64(blob) })
}
export const writeTextutil = (html: string) => async (path: string) => {
  await invoke('save_with_textutil', { html, to: 'doc', path })
}
