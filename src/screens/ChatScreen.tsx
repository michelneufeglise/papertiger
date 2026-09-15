import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Paperclip, X } from 'lucide-react'
import { GlassButton, Kbd } from '../components/ui'
import { mockMessages, getRandomAssistantReply } from '../mock/messages'
import type { Message } from '../mock/messages'
import { generateSection, getPaper } from '../lib/paper'

const WRITE_KEYWORDS = ['write', 'draft', 'abstract']

const MAX_TEXTAREA_LINES = 6
const LINE_HEIGHT_PX = 20 // approx line-height for the 14px composer text
const MIN_TEXTAREA_HEIGHT_PX = 40
const MAX_TEXTAREA_HEIGHT_PX = MIN_TEXTAREA_HEIGHT_PX + (MAX_TEXTAREA_LINES - 1) * LINE_HEIGHT_PX

const suggestions = [
  'Outline a methods section',
  'Summarize my sources',
  'Turn my notes into an abstract',
]

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Renders the tiny markdown subset the writer uses: **bold** only. */
const renderRich = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }, 0)
    }
  }, [messages])

  const resizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX) + 'px'
  }

  const sendMessage = (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT_PX}px`
    }

    const lowerContent = content.toLowerCase()
    const wantsWriting = WRITE_KEYWORDS.some(keyword => lowerContent.includes(keyword))

    // Simulate assistant response delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: wantsWriting
          ? 'On it — drafting the next section on the right.'
          : getRandomAssistantReply(),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)

      if (wantsWriting) {
        const emptySection = getPaper().sections.find(section => section.status === 'empty')
        if (emptySection) void generateSection(emptySection.id)
      }
    }, 800)
  }

  const handleSendMessage = () => sendMessage(inputValue)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    resizeTextarea(e.target)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    if (textareaRef.current) {
      textareaRef.current.focus()
      resizeTextarea(textareaRef.current)
    }
  }

  const handleClear = () => {
    setMessages([])
    setInputValue('')
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thread */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-6 min-h-full flex flex-col">
          {!isEmpty && (
            <div className="flex justify-end mb-2">
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono uppercase tracking-[0.08em] text-fg-faint hover:text-fg-muted hover:bg-[var(--panel-2)] transition-colors"
              >
                <X size={12} />
                Clear
              </button>
            </div>
          )}

          {isEmpty ? (
            <motion.div
              className="flex-1 flex flex-col items-center justify-center text-center px-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-display font-bold text-[40px] leading-tight text-fg mb-3">
                What are we writing today?
              </h1>
              <p className="text-sm text-fg-muted max-w-sm mb-8">
                Tell me the topic, paste notes, or drop a PDF in Sources.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                {suggestions.map((suggestion, i) => (
                  <motion.button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3.5 py-2 rounded-full border border-tiger/40 text-tiger text-sm hover:bg-tiger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence mode="popLayout">
                {messages.map((message, i) => (
                  <motion.div
                    key={message.id}
                    className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.15) }}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[85%] flex flex-col items-end">
                        <div className="px-4 py-3 bg-tiger/15 border border-tiger/30 rounded-[var(--r-lg)] rounded-br-sm">
                          <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                            {renderRich(message.content)}
                          </p>
                        </div>
                        <span className="mt-1 px-1 font-mono text-[11px] text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                    ) : (
                      <div className="max-w-[85%] flex gap-3">
                        <div className="shrink-0 w-6 h-6 rounded-[var(--r-sm)] bg-[var(--panel-2)] flex items-center justify-center font-display font-bold text-[11px] text-fg">
                          pt
                        </div>
                        <div className="flex flex-col items-start pt-0.5">
                          <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                            {renderRich(message.content)}
                          </p>
                          <span className="mt-1 font-mono text-[11px] text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    key="typing-indicator"
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-[var(--r-sm)] bg-[var(--panel-2)] flex items-center justify-center font-display font-bold text-[11px] text-fg">
                        pt
                      </div>
                      <div className="flex items-center gap-1.5 pt-2.5">
                        {[0, 1, 2].map(i => (
                          <motion.span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-tiger"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 px-6 pb-6 pt-2">
        <div className="max-w-[760px] mx-auto">
          <div className="glass rounded-[var(--r-lg)] p-2.5 flex items-end gap-2">
            <button
              className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
              aria-label="Attach a file"
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tell me the topic, paste notes, or ask a question…"
              className="flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm text-fg placeholder:text-fg-faint outline-none"
              rows={1}
              style={{ minHeight: MIN_TEXTAREA_HEIGHT_PX, maxHeight: MAX_TEXTAREA_HEIGHT_PX }}
            />

            <GlassButton
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              variant="primary"
              className="shrink-0 h-9 w-9 !p-0 rounded-full"
              aria-label="Send message"
            >
              <Send size={16} />
            </GlassButton>
          </div>

          <div className="mt-2 flex items-center gap-3 px-1 font-mono text-[11px] text-fg-faint">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd> send
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>⇧↵</Kbd> newline
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
