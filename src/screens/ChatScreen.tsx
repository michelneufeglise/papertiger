import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Send, Paperclip, X } from 'lucide-react'
import { GlassButton, Kbd, Tiger } from '../components/ui'
import { useChat, sendMessage, clear } from '../lib/chat'
import { useSettings } from '../lib/settings'

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
  const messages = useChat()
  const settings = useSettings()
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
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

  const handleSendMessage = () => {
    const content = inputValue
    if (!content.trim() || isSending) return

    setInputValue('')
    setIsSending(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT_PX}px`
    }

    void sendMessage(content).finally(() => setIsSending(false))
  }

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
    clear()
    setInputValue('')
  }

  const isEmpty = messages.length === 0
  const writerConfigured = settings.writerTag !== null

  // A freshly-pushed streaming assistant message with no content yet is shown as
  // the typing indicator instead of an empty bubble; once tokens start arriving
  // it re-appears in the list below with its own growing text + caret.
  const emptyStreamingMessage = messages.find((m) => m.streaming && m.content.length === 0)
  const visibleMessages = emptyStreamingMessage
    ? messages.filter((m) => m.id !== emptyStreamingMessage.id)
    : messages
  const lastMessage = messages[messages.length - 1]
  const showTyping = isSending && !(lastMessage?.role === 'assistant' && lastMessage.content.length > 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Thread */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-6 py-6 min-h-full flex flex-col">
          {!isEmpty && (
            <div className="flex justify-end mb-2">
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-display text-[17px] text-fg-muted hover:text-fg hover:bg-rose/40 transition-colors"
              >
                <X size={14} />
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
              <motion.div
                initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              >
                <Tiger state="hopeful" size={140} alt="papertiger" />
              </motion.div>
              <h1 className="font-display text-[40px] leading-tight text-fg mt-2 mb-3">
                <span className="doodle-underline">What are we writing today?</span>
              </h1>
              <p className="text-sm text-fg-muted max-w-sm mb-8">
                Tell me the topic, paste notes, or drop a PDF in Sources.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg">
                {suggestions.map((suggestion, i) => (
                  <motion.button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`sketch-btn ${i % 2 ? 'sketch-alt' : 'sketch'} px-4 py-2 font-display text-[18px] text-fg hover:bg-rose/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose`}
                    style={{ rotate: i === 0 ? -2 : i === 1 ? 1.5 : -1 }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 + i * 0.06 }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((message, i) => (
                  <motion.div
                    key={message.id}
                    className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24, delay: Math.min(i * 0.03, 0.15) }}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[85%] flex flex-col items-end">
                        <div className="relative px-4 py-3 bg-tiger text-on-tiger border-2 border-[var(--line)] wobble shadow-[3px_4px_0_var(--line)]">
                          <span
                            aria-hidden="true"
                            className="absolute -right-[7px] bottom-3 h-3 w-3 rotate-45 bg-tiger border-t-2 border-r-2 border-[var(--line)]"
                          />
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {renderRich(message.content)}
                          </p>
                        </div>
                        <span className="mt-1.5 px-1 font-mono text-[11px] text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                    ) : (
                      <div className="max-w-[85%] flex gap-3 items-start">
                        <Tiger
                          cycle={!message.streaming}
                          state={message.streaming ? 'talking' : undefined}
                          size={36}
                        />
                        <div className="flex flex-col items-start">
                          <div className="sketch relative px-4 py-3">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[7px] bottom-3 h-3 w-3 rotate-45 bg-[var(--panel)] border-b-2 border-l-2 border-[var(--line)]"
                            />
                            <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                              {renderRich(message.content)}
                              {message.streaming && <span className="text-fg caret-blink">▍</span>}
                            </p>
                          </div>
                          <span className="mt-1.5 px-1 font-mono text-[11px] text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {showTyping && (
                  <motion.div
                    key="typing-indicator"
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  >
                    <div className="flex gap-3 items-start">
                      <Tiger state="thinking" size={36} />
                      <div className="sketch relative px-4 py-3 flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="absolute -left-[7px] bottom-3 h-3 w-3 rotate-45 bg-[var(--panel)] border-b-2 border-l-2 border-[var(--line)]"
                        />
                        {[0, 1, 2].map(i => (
                          <motion.span
                            key={i}
                            className="w-2 h-2 rounded-full bg-tiger"
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
          {!writerConfigured && (
            <p className="mb-2 px-1 font-mono text-[11px] text-fg-faint">
              No writer yet — replies are canned. Add one in{' '}
              <Link to="/setup?step=writer" className="text-fg underline decoration-wavy decoration-rose underline-offset-2">
                Settings
              </Link>
              .
            </p>
          )}

          <div className="sketch p-2.5 flex items-end gap-2">
            <button
              className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-fg-muted hover:bg-rose/40 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
              aria-label="Attach a file"
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Topic, notes, or a question…"
              className="flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm text-fg placeholder:text-fg-faint outline-none"
              rows={1}
              style={{ minHeight: MIN_TEXTAREA_HEIGHT_PX, maxHeight: MAX_TEXTAREA_HEIGHT_PX }}
            />

            <GlassButton
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isSending}
              variant="primary"
              className="shrink-0 h-10 w-10 !p-0 rounded-full"
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
