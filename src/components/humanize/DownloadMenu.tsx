import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown, Download } from 'lucide-react'
import {
  EXPORT_FORMATS,
  exportDocument,
  formatInfo,
  saveExport,
  type ExportFormat,
} from '../../lib/humanize/export'
import type { Block } from '../../lib/humanize/segment'
import { isTauri } from '../../lib/tauri'

const KEY = 'papertiger.humanizeExport'

function loadFormat(): ExportFormat {
  try {
    const v = localStorage.getItem(KEY)
    const f = EXPORT_FORMATS.find((x) => x.id === v)
    if (f && (!f.tauriOnly || isTauri())) return f.id
  } catch {
    /* storage unavailable */
  }
  return 'docx'
}

export interface DownloadMenuProps {
  title: string
  blocks: Block[]
  outputs: Record<number, string>
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function DownloadMenu({ title, blocks, outputs, size = 'md', disabled }: DownloadMenuProps) {
  const [format, setFormat] = useState<ExportFormat>(loadFormat)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const run = async (f: ExportFormat) => {
    setOpen(false)
    setFormat(f)
    try {
      localStorage.setItem(KEY, f)
    } catch {
      /* storage unavailable */
    }
    setBusy(true)
    setError(false)
    try {
      const info = formatInfo(f)
      const data = await exportDocument(f, title, blocks, outputs)
      const ok = await saveExport(f, data, `${title || 'document'} (humanized).${info.ext}`)
      if (ok) {
        setSaved(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const formats = EXPORT_FORMATS.filter((f) => !f.tauriOnly || isTauri())
  const h = size === 'sm' ? 'h-8 text-[15px]' : 'h-10 text-[17px]'
  const part = 'font-display inline-flex items-center gap-1.5 bg-panel text-fg border-2 border-[var(--line)] select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose disabled:opacity-40 disabled:pointer-events-none hover:bg-rose/30 transition-colors'

  return (
    <div
      ref={root}
      className="relative inline-flex"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <div className="wobble inline-flex shadow-[3px_4px_0_var(--line)]">
        <button
          type="button"
          className={clsx(part, h, 'rounded-l-[10px] pl-3 pr-2.5 border-r-0')}
          disabled={disabled || busy}
          onClick={() => run(format)}
        >
          {saved ? <Check size={15} aria-hidden /> : <Download size={15} aria-hidden />}
          {saved ? 'Saved' : error ? 'Failed, retry' : `Download .${formatInfo(format).ext}`}
        </button>
        <button
          type="button"
          aria-label="Choose download format"
          aria-haspopup="menu"
          aria-expanded={open}
          className={clsx(part, h, 'rounded-r-[10px] px-2')}
          disabled={disabled || busy}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={15} aria-hidden />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          aria-label="Download format"
          className="absolute right-0 top-full z-50 mt-2 min-w-[14rem] bg-panel border-2 border-[var(--line)] rounded-[12px] p-1.5 shadow-[3px_4px_0_var(--line)]"
        >
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              autoFocus={f.id === format}
              onClick={() => run(f.id)}
              className={clsx(
                'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[16px] text-fg',
                'hover:bg-rose/40 focus-visible:bg-rose/40 focus-visible:outline-none',
              )}
            >
              {f.label}
              {f.id === format && <Check size={14} aria-hidden />}
            </button>
          ))}
          <p className="px-2.5 pt-1.5 pb-1 text-[13px] text-fg-muted">Pages opens .docx</p>
        </div>
      )}
    </div>
  )
}
