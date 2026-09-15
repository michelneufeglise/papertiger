import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Zap, Download } from 'lucide-react'
import { GlassCard, GlassButton, GlassTextarea, Stripe } from '../components/ui'
import { usePaper, setTitle, updateSection, generateSection, wordCount } from '../lib/paper'
import type { Paper } from '../lib/paper'

export const EditorScreen: React.FC = () => {
  const paper = usePaper()
  const [activeSection, setActiveSection] = useState(paper.sections[0]?.id ?? '')
  // Snapshot of the active section's content taken right before a generation
  // starts, so the textarea stays frozen while the streamed text (which lives
  // in the store, growing live) is shown separately below it with a caret.
  const [generationBase, setGenerationBase] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentSection = paper.sections.find(s => s.id === activeSection) ?? paper.sections[0]
  const isGenerating = paper.sections.some(s => s.status === 'writing')
  const isCurrentGenerating = currentSection?.status === 'writing'
  const totalWordCount = wordCount(paper)

  // While the tiger writes, size the textarea to its content so the streamed text follows it directly.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = isCurrentGenerating ? `${el.scrollHeight}px` : ''
  }, [isCurrentGenerating, activeSection])

  const handleSectionUpdate = (sectionId: string, content: string) => {
    updateSection(sectionId, { content })
  }

  const handleGenerateSection = () => {
    if (!currentSection || isGenerating) return
    setGenerationBase(currentSection.content)
    void generateSection(currentSection.id)
  }

  const handleExport = () => {
    // Mock export
    const content = `${paper.title}\n\n${paper.sections
      .map(s => `${s.title}\n${s.content}`)
      .join('\n\n')}`
    console.log('Exported:', content)
  }

  // The streamed text produced during this generation, isolated from the
  // frozen base content the textarea still shows.
  const streamedText =
    isCurrentGenerating && currentSection
      ? currentSection.content.slice(generationBase.length).replace(/^\n\n/, '')
      : ''

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 h-16 border-b border-line">
        <input
          value={paper.title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled paper"
          className="min-w-0 flex-1 bg-transparent border-none outline-none font-display text-[22px] font-bold text-fg placeholder:text-fg-faint caret-tiger"
        />

        <div className="shrink-0 font-mono text-xs text-fg-muted whitespace-nowrap">
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
        <div className="w-[200px] shrink-0 border-r border-line overflow-y-auto p-3">
          <div className="px-2 mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
            Outline
          </div>

          <div className="flex flex-col gap-1">
            {paper.sections.map(section => {
              const active = section.id === activeSection
              const sectionWords = wordCount({ title: '', sections: [section] } satisfies Paper)

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  disabled={isGenerating && !active}
                  className={clsx(
                    'relative w-full flex items-center justify-between gap-2 rounded-[var(--r-sm)] pl-4 pr-3 py-2 text-left text-sm transition-colors',
                    'disabled:opacity-40 disabled:pointer-events-none',
                    active ? 'bg-[var(--panel-2)] text-fg font-semibold' : 'text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="outline-bar"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-tiger"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="truncate">{section.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-faint">
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

              <h2 className="font-display text-[20px] font-bold text-fg">
                {currentSection.title}
              </h2>

              {isCurrentGenerating && (
                <div className="mt-1 font-mono text-xs text-tiger">writing…</div>
              )}

              <GlassTextarea
                ref={textareaRef}
                value={isCurrentGenerating ? generationBase : currentSection.content}
                onChange={e => handleSectionUpdate(currentSection.id, e.target.value)}
                placeholder="Start writing, or generate a draft…"
                disabled={isCurrentGenerating}
                className={`mt-4 min-h-[200px] !bg-transparent !border-none !shadow-none !rounded-none !p-0 !text-base leading-[1.7] text-fg placeholder:text-fg-faint disabled:!opacity-100 ${
                  isCurrentGenerating ? 'flex-none' : 'flex-1'
                }`}
              />

              {isCurrentGenerating && (
                <p className="mt-2 text-base leading-[1.7] text-fg whitespace-pre-wrap">
                  {streamedText}
                  <span className="text-tiger caret-blink">▍</span>
                </p>
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
