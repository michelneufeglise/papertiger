import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Zap, Download } from 'lucide-react'
import { GlassCard, GlassButton, GlassTextarea, Stripe } from '../components/ui'
import { mockPaperSections, mockPaperTitle, calculateWordCount } from '../mock/paper'
import type { PaperSection } from '../mock/paper'

const SAMPLE_GENERATED_TEXT =
  'Recent advances in machine learning have demonstrated remarkable potential in addressing complex clinical challenges. Our approach leverages state-of-the-art deep learning architectures to process multimodal patient data streams. The architectural design incorporates attention mechanisms to capture temporal dependencies and clinical significance indicators. Implementation across diverse healthcare settings has revealed consistent improvements in predictive accuracy and clinical utility. Furthermore, the model exhibits robust generalization across different patient populations and clinical contexts. Integration into existing clinical workflows requires careful consideration of alert fatigue and clinician acceptance factors.'

export const EditorScreen: React.FC = () => {
  const [sections, setSections] = useState<PaperSection[]>(mockPaperSections)
  const [activeSection, setActiveSection] = useState(mockPaperSections[0].id)
  const [title, setTitle] = useState(mockPaperTitle)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const generateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // While the tiger writes, size the textarea to its content so the streamed text follows it directly.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = isGenerating ? `${el.scrollHeight}px` : ''
  }, [isGenerating, activeSection])

  useEffect(() => {
    return () => {
      if (generateIntervalRef.current) clearInterval(generateIntervalRef.current)
    }
  }, [])

  const currentSection = sections.find(s => s.id === activeSection)
  const wordCount = calculateWordCount(sections)

  const handleSectionUpdate = (sectionId: string, content: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId ? { ...section, content } : section
      )
    )
  }

  const handleGenerateSection = () => {
    if (!currentSection || isGenerating) return
    setIsGenerating(true)
    setGeneratedText('')

    const sectionId = currentSection.id
    const baseContent = currentSection.content

    // Simulate token-by-token text generation
    let charIndex = 0
    generateIntervalRef.current = setInterval(() => {
      if (charIndex < SAMPLE_GENERATED_TEXT.length) {
        setGeneratedText(SAMPLE_GENERATED_TEXT.substring(0, charIndex + 1))
        charIndex++
      } else {
        if (generateIntervalRef.current) clearInterval(generateIntervalRef.current)
        setIsGenerating(false)
        setGeneratedText('')
        // Auto-append to section
        handleSectionUpdate(sectionId, `${baseContent}\n\n${SAMPLE_GENERATED_TEXT}`)
      }
    }, 15)
  }

  const handleExport = () => {
    // Mock export
    const content = `${title}\n\n${sections
      .map(s => `${s.title}\n${s.content}`)
      .join('\n\n')}`
    console.log('Exported:', content)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 h-16 border-b border-line">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled paper"
          className="min-w-0 flex-1 bg-transparent border-none outline-none font-display text-[22px] font-bold text-fg placeholder:text-fg-faint caret-tiger"
        />

        <div className="shrink-0 font-mono text-xs text-fg-muted whitespace-nowrap">
          {wordCount.toLocaleString()} words · {sections.length} sections
        </div>

        <GlassButton
          onClick={handleGenerateSection}
          disabled={isGenerating}
          variant="primary"
          size="sm"
          icon={<Zap size={14} />}
          className="shrink-0"
        >
          {isGenerating ? 'Writing…' : 'Generate'}
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
            {sections.map(section => {
              const active = section.id === activeSection
              const sectionWords = calculateWordCount([section])

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
              {isGenerating && (
                <Stripe active className="absolute top-0 left-0 right-0 w-full rounded-none" />
              )}

              <h2 className="font-display text-[20px] font-bold text-fg">
                {currentSection.title}
              </h2>

              {isGenerating && (
                <div className="mt-1 font-mono text-xs text-tiger">writing…</div>
              )}

              <GlassTextarea
                ref={textareaRef}
                value={currentSection.content}
                onChange={e => handleSectionUpdate(currentSection.id, e.target.value)}
                placeholder="Start writing, or generate a draft…"
                disabled={isGenerating}
                className={`mt-4 min-h-[200px] !bg-transparent !border-none !shadow-none !rounded-none !p-0 !text-base leading-[1.7] text-fg placeholder:text-fg-faint disabled:!opacity-100 ${
                  isGenerating ? 'flex-none' : 'flex-1'
                }`}
              />

              {isGenerating && (
                <p className="mt-2 text-base leading-[1.7] text-fg whitespace-pre-wrap">
                  {generatedText}
                  <span className="text-tiger caret-blink">▍</span>
                </p>
              )}

              <div className="mt-4 font-mono text-xs text-fg-faint">
                {calculateWordCount([currentSection])} words
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
