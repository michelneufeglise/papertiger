import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenLine, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { usePaper, wordCount } from '../lib/paper'
import { useSettings } from '../lib/settings'
import { writerById } from '../lib/models'

const COLLAPSE_KEY = 'papertiger.paperPanel'
const PREVIEW_CHAR_LIMIT = 900

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
      <div className="shrink-0 w-11 h-full glass rounded-none border-l border-line flex flex-col items-center py-4 gap-4">
        <button
          onClick={toggleCollapsed}
          className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
          aria-label="Open paper panel"
        >
          <PanelRightOpen size={15} />
        </button>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint select-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          Paper
        </div>
      </div>
    )
  }

  return (
    <div className="shrink-0 w-[360px] h-full glass rounded-none border-l border-line flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-14 border-b border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Paper</span>
        <span className="font-mono text-[11px] text-fg-muted whitespace-nowrap">
          {words.toLocaleString()} words
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => navigate('/editor')}
            className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
            aria-label="Open in Draft"
          >
            <PenLine size={15} />
          </button>
          <button
            onClick={toggleCollapsed}
            className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--r-sm)] text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
            aria-label="Collapse paper panel"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {showWritingWith && (
        <div className="shrink-0 px-4 py-1.5 border-b border-line font-mono text-[11px] text-fg-faint">
          writing with {activeWriter.label}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="bg-panel rounded-[var(--r-lg)] p-6">
          <h2 className="font-display text-[20px] font-bold text-fg">
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
                      className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full bg-tiger"
                    />
                  )}

                  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint mb-1.5">
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
                        <span className="text-tiger caret-blink">▍</span>
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
      <div className="shrink-0 px-4 h-9 flex items-center border-t border-line font-mono text-[11px] text-fg-faint">
        {doneCount} of {paper.sections.length} sections written
      </div>
    </div>
  )
}
