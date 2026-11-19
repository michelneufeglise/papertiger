import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Zap, Download, Square } from 'lucide-react'
import { GlassCard, GlassButton, GlassTextarea, Stripe, Tiger } from '../components/ui'
import { usePaper, setTitle, updateSection, generateSection, wordCount } from '../lib/paper'
import type { Paper } from '../lib/paper'

interface GenerationError {
  sectionId: string
  message: string
}

export const EditorScreen: React.FC = () => {
  const paper = usePaper()
  const [activeSection, setActiveSection] = useState(paper.sections[0]?.id ?? '')
  const [generationError, setGenerationError] = useState<GenerationError | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const currentSection = paper.sections.find(s => s.id === activeSection) ?? paper.sections[0]
  const isGenerating = paper.sections.some(s => s.status === 'writing')
  const isCurrentGenerating = currentSection?.status === 'writing'
  const totalWordCount = wordCount(paper)

  const handleSectionUpdate = (sectionId: string, content: string) => {
    updateSection(sectionId, { content })
  }

  const handleGenerateSection = () => {
    if (!currentSection || isGenerating) return
    setGenerationError(null)
    const controller = new AbortController()
    abortControllerRef.current = controller
    generateSection(currentSection.id, controller.signal).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setGenerationError({ sectionId: currentSection.id, message })
    })
  }

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort()
  }

  const handleExport = () => {
    // Mock export
    const content = `${paper.title}\n\n${paper.sections
      .map(s => `${s.title}\n${s.content}`)
      .join('\n\n')}`
    console.log('Exported:', content)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 h-16 border-b-2 border-dashed border-[var(--line-soft)]">
        <input
          value={paper.title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled paper"
          className="min-w-0 flex-1 bg-transparent border-none outline-none font-display text-[26px] text-fg placeholder:text-fg-faint caret-tiger"
        />

        <div className="shrink-0 font-mono text-xs text-fg-muted whitespace-nowrap wobble border-2 border-dashed border-[var(--line-soft)] px-2.5 py-1 rotate-1">
          {totalWordCount.toLocaleString()} words · {paper.sections.length} sections
        </div>

        <GlassButton
          onClick={handleGenerateSection}
          disabled={isGenerating}
          variant="primary"
          size="sm"
          icon={<Zap size={14} />}
          className="shrink-0"
        >
          {isCurrentGenerating ? 'Writing…' : 'Generate'}
        </GlassButton>

        {isCurrentGenerating && (
          <GlassButton
            onClick={handleStopGeneration}
            variant="ghost"
            size="sm"
            icon={<Square size={14} />}
            className="shrink-0"
          >
            Stop
          </GlassButton>
        )}

        <GlassButton
          onClick={handleExport}
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          className="shrink-0"
        >
          Export
        </GlassButton>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline rail */}
        <div className="w-[210px] shrink-0 border-r-2 border-dashed border-[var(--line-soft)] overflow-y-auto p-3">
          <div className="px-2 mb-2 font-display text-[19px] text-fg doodle-underline">
            Outline
          </div>

          <div className="flex flex-col gap-2.5 mt-3">
            {paper.sections.map((section, idx) => {
              const active = section.id === activeSection
              const sectionWords = wordCount({ title: '', sections: [section] } satisfies Paper)

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  disabled={isGenerating && !active}
                  className={clsx(
                    'sketch-btn relative w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[17px] font-display',
                    'disabled:opacity-40 disabled:pointer-events-none',
                    idx % 2 ? 'sketch-alt' : 'sketch',
                    active ? 'text-fg' : 'text-fg-muted hover:text-fg'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="outline-bar"
                      className="highlighter absolute inset-x-1 top-1.5 bottom-1.5 -z-0 -rotate-1"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative truncate">{section.title}</span>
                  <span className="relative shrink-0 font-mono text-[11px] text-fg-muted">
                    {sectionWords}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Editor surface */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentSection && (
            <GlassCard
              key={currentSection.id}
              variant="raised"
              className="relative min-h-full flex flex-col overflow-hidden p-8"
            >
              {isCurrentGenerating && (
                <Stripe active className="absolute top-0 left-0 right-0 w-full rounded-none" />
              )}

              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[26px] leading-tight text-fg">
                  <span className="doodle-underline">{currentSection.title}</span>
                </h2>
                {isCurrentGenerating && <Tiger cycle size={48} className="shrink-0" />}
              </div>

              {isCurrentGenerating && (
                <div className="mt-2 font-mono text-xs text-fg-muted">writing…</div>
              )}

              {generationError && generationError.sectionId === currentSection.id && (
                <p className="mt-1 font-mono text-xs text-danger">{generationError.message}</p>
              )}

              {isCurrentGenerating ? (
                <p className="mt-4 flex-1 text-base leading-[1.7] text-fg whitespace-pre-wrap">
                  {currentSection.content}
                  <span className="text-tiger caret-blink">▍</span>
                </p>
              ) : (
                <GlassTextarea
                  value={currentSection.content}
                  onChange={e => handleSectionUpdate(currentSection.id, e.target.value)}
                  placeholder="Start writing, or generate a draft…"
                  className="mt-4 flex-1 min-h-[200px] !bg-transparent !border-none !shadow-none !rounded-none !p-0 !text-base leading-[1.7] text-fg placeholder:text-fg-faint"
                />
              )}

              <div className="mt-4 font-mono text-xs text-fg-faint">
                {wordCount({ title: '', sections: [currentSection] } satisfies Paper)} words
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
