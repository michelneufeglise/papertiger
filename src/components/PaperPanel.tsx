import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenLine, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { usePaper, wordCount } from '../lib/paper'
import { useSettings } from '../lib/settings'
import { writerById } from '../lib/models'
import { Tiger } from './ui/Tiger'
import { SketchFrame } from './ui/SketchFrame'

const COLLAPSE_KEY = 'papertiger.paperPanel'
const WIDTH_KEY = 'papertiger.paperPanelWidth'
const DEFAULT_WIDTH = 480
const MIN_WIDTH = 380
const KEY_STEP = 24
const PREVIEW_CHAR_LIMIT = 1800

function maxWidth(): number {
  if (typeof window === 'undefined') return 900
  return Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.5))
}

function clampWidth(w: number): number {
  return Math.min(Math.max(w, MIN_WIDTH), maxWidth())
}

function readWidth(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_KEY)
    const n = raw === null ? NaN : Number(raw)
    return clampWidth(Number.isFinite(n) ? n : DEFAULT_WIDTH)
  } catch {
    return clampWidth(DEFAULT_WIDTH)
  }
}

function writeWidth(w: number): void {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(w)))
  } catch {
    // ignore (e.g. storage disabled)
  }
}

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? 'collapsed' : 'open')
  } catch {
    // ignore (e.g. storage disabled)
  }
}

const ShimmerLine: React.FC<{ width: string }> = ({ width }) => (
  <div className="shimmer h-[10px] rounded-full" style={{ width }} />
)

export const PaperPanel: React.FC = () => {
  const navigate = useNavigate()
  const paper = usePaper()
  const settings = useSettings()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const writingSectionRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(readWidth)
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    const onResize = () => setWidth(w => clampWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onHandleDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = widthRef.current
    const move = (ev: PointerEvent) => setWidth(clampWidth(startW + (startX - ev.clientX)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      writeWidth(widthRef.current)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const onHandleKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    // The handle is on the left edge: ArrowLeft widens, ArrowRight narrows.
    const next = clampWidth(widthRef.current + (e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP))
    setWidth(next)
    writeWidth(next)
  }, [])

  const words = wordCount(paper)
  const doneCount = paper.sections.filter(s => s.status === 'done').length
  const writingSection = paper.sections.find(s => s.status === 'writing')
  const activeWriter = settings.writerId ? writerById(settings.writerId) : undefined
  const showWritingWith = writingSection !== undefined && activeWriter !== undefined

  useEffect(() => {
    writeCollapsed(collapsed)
  }, [collapsed])

  useEffect(() => {
    if (writingSection && writingSectionRef.current) {
      writingSectionRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    // Re-run as content streams in so the sheet keeps following the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writingSection?.id, writingSection?.content])

  const toggleCollapsed = () => setCollapsed(c => !c)

  if (collapsed) {
    return (
      <SketchFrame seed={4} radius={18} className="shrink-0 w-11 h-full flex flex-col items-center py-4 gap-4">
        <button
          onClick={toggleCollapsed}
          className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-rose/50 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          aria-label="Open paper panel"
        >
          <PanelRightOpen size={15} />
        </button>
        <div
          className="font-display text-[16px] text-fg-muted select-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          Paper
        </div>
      </SketchFrame>
    )
  }

  return (
    <div
      className="relative shrink-0 h-full flex flex-col"
      style={{ width }}
    >
      {/* Resize handle on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize paper panel"
        aria-valuenow={Math.round(width)}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth()}
        tabIndex={0}
        onPointerDown={onHandleDown}
        onKeyDown={onHandleKey}
        className="group absolute -left-3 top-0 bottom-0 w-3 z-20 cursor-col-resize flex items-center justify-center focus-visible:outline-none"
      >
        <span className="h-16 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--line)_40%,transparent)] group-hover:bg-rose group-active:bg-rose group-focus-visible:bg-rose transition-colors" />
      </div>

      <SketchFrame
        seed={4}
        radius={18}
        className="flex-1 min-h-0 flex flex-col"
        style={{ rotate: '0.4deg' }}
      >
        {/* Tape strip */}
        <div
          aria-hidden="true"
          className="absolute -top-0.5 left-1/2 z-10 h-5 w-24 -translate-x-1/2 -rotate-2 border border-[var(--line-soft)]"
          style={{ background: 'color-mix(in srgb, var(--rose) 60%, transparent)' }}
        />
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-16 pt-2 border-b-2 border-dashed border-[var(--line-soft)]">
        {writingSection ? <Tiger state="writing" size={40} /> : <Tiger cycle size={40} />}
        <span className="font-display text-[20px] text-fg">Paper</span>
        <span className="font-mono text-[11px] text-fg-muted whitespace-nowrap">
          {words.toLocaleString()} words
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => navigate('/editor')}
            className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-rose/50 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            aria-label="Open in Draft"
          >
            <PenLine size={15} />
          </button>
          <button
            onClick={toggleCollapsed}
            className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-rose/50 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            aria-label="Collapse paper panel"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {showWritingWith && (
        <div className="shrink-0 px-4 py-1.5 border-b-2 border-dashed border-[var(--line-soft)] font-mono text-[11px] text-fg-faint">
          writing with {activeWriter.label}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="p-5">
          <h2 className="font-display text-[26px] leading-tight text-fg doodle-underline">
            {paper.title || 'Untitled paper'}
          </h2>

          <div className="mt-5 flex flex-col gap-5">
            {paper.sections.map(section => {
              const isWriting = section.status === 'writing'
              const preview =
                section.content.length > PREVIEW_CHAR_LIMIT
                  ? `${section.content.slice(0, PREVIEW_CHAR_LIMIT)}…`
                  : section.content

              return (
                <div
                  key={section.id}
                  ref={isWriting ? writingSectionRef : undefined}
                  className="relative pl-3"
                >
                  {isWriting && (
                    <div
                      aria-hidden="true"
                      className="hatch hatch-animate absolute left-0 top-0.5 bottom-0.5 w-1.5 rounded-full"
                    />
                  )}

                  <div className="font-display text-[17px] text-fg-muted mb-1">
                    {section.title}
                  </div>

                  {section.status === 'done' && (
                    <p className="text-[13px] leading-[1.6] text-fg-muted whitespace-pre-wrap">
                      {preview}
                    </p>
                  )}

                  {isWriting && (
                    <div>
                      <p className="text-[13px] leading-[1.6] text-fg whitespace-pre-wrap">
                        {section.content}
                        <span className="text-fg caret-blink">▍</span>
                      </p>
                      <div className="shimmer h-[10px] rounded-full mt-2" style={{ width: '70%' }} />
                    </div>
                  )}

                  {section.status === 'empty' && (
                    <div className="flex flex-col gap-1.5">
                      <ShimmerLine width="100%" />
                      <ShimmerLine width="92%" />
                      <ShimmerLine width="96%" />
                      <ShimmerLine width="60%" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 h-9 flex items-center rounded-b-[18px] border-t-2 border-dashed border-[var(--line-soft)] font-mono text-[11px] text-fg-faint">
        {doneCount} of {paper.sections.length} sections written
      </div>
      </SketchFrame>
    </div>
  )
}
