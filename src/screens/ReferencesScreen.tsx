import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload, Trash2, Eye } from 'lucide-react'
import { tigerForSource } from '../lib/tiger'
import { GlassCard, GlassButton, StatusChip, Stripe, Modal, Chip, Tiger } from '../components/ui'
import type { Source } from '../lib/sources'
import { useSources, cancel, removeSource } from '../lib/sourcesStore'
import { addFiles, pickFiles, useFileDrop } from '../lib/addFiles'
import { useSettings } from '../lib/settings'

function typeLabel(source: Pick<Source, 'kind' | 'name'>): string {
  if (source.kind === 'pdf') return 'PDF'
  if (source.kind === 'image') return 'IMG'
  if (source.kind === 'docx') return 'DOCX'
  const dot = source.name.lastIndexOf('.')
  return (dot < 0 ? 'DOC' : source.name.slice(dot + 1)).toUpperCase().slice(0, 5)
}

/** Small mono "7d ago" style relative-time helper. */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 4) return `${diffWeek}w ago`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth}mo ago`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(source: Source): string {
  switch (source.status) {
    case 'queued':
      return 'Queued'
    case 'rendering':
      return 'Rendering'
    case 'extracting':
      return `Extracting ${source.progress.page}/${source.progress.pages}`
    case 'done':
      return 'Extracted'
    case 'error':
      return 'Failed'
  }
}

const statusChipStatus: Record<Source['status'], 'idle' | 'processing' | 'success' | 'error'> = {
  queued: 'idle',
  rendering: 'processing',
  extracting: 'processing',
  done: 'success',
  error: 'error',
}

interface SkipNotice {
  id: string
  name: string
}

export const ReferencesScreen: React.FC = () => {
  const navigate = useNavigate()
  const settings = useSettings()

  const sources = useSources()
  // Re-render once a second while extracting so a row can drift to sleepy-reading.
  const [, setNow] = useState(0)
  const anyExtracting = sources.some(s => s.status === 'extracting')
  useEffect(() => {
    if (!anyExtracting) return
    const id = setInterval(() => setNow(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [anyExtracting])
  const rowTiger = (s: Source) => tigerForSource(s)
  const [skipNotices, setSkipNotices] = useState<SkipNotice[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const addSkipNotice = useCallback((name: string) => {
    const id = crypto.randomUUID()
    setSkipNotices((prev) => [...prev, { id, name }])
    setTimeout(() => {
      setSkipNotices((prev) => prev.filter((n) => n.id !== id))
    }, 4000)
  }, [])

  const handleInputs = useCallback(
    (inputs: Parameters<typeof addFiles>[0]) => {
      void addFiles(inputs, addSkipNotice)
    },
    [addSkipNotice],
  )
  const { isDragOver, dropProps } = useFileDrop(handleInputs)

  const handleRemove = useCallback((id: string) => {
    cancel(id)
    removeSource(id)
  }, [])

  const handlePreview = useCallback((id: string) => {
    setSelectedSourceId(id)
    setIsPreviewOpen(true)
    setCopied(false)
  }, [])

  const handleChooseFiles = useCallback(async () => {
    handleInputs(await pickFiles())
  }, [handleInputs])

  // --- Preview modal ------------------------------------------------

  const selectedSource = selectedSourceId ? (sources.find((s) => s.id === selectedSourceId) ?? null) : null

  const handleCopyText = useCallback(async () => {
    if (!selectedSource) return
    try {
      await navigator.clipboard.writeText(selectedSource.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied — silently ignore, the button just won't flip to "Copied".
    }
  }, [selectedSource])

  const needsOcrModel = settings.ocrTag === null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b-2 border-dashed border-[var(--line-soft)]">
        <h1 className="font-display text-[32px] text-fg mb-1.5">
          <span className="doodle-underline">Sources</span>
        </h1>
        <p className="text-sm text-fg-muted">Everything the paper will be built on. Text is extracted on this Mac.</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {needsOcrModel && (
            <div className="flex items-center justify-between gap-4 sketch-alt bg-rose/40 px-4 py-3">
              <p className="text-sm text-fg">Pick an OCR model first</p>
              <GlassButton onClick={() => navigate('/setup')} variant="secondary" size="sm">
                Open setup
              </GlassButton>
            </div>
          )}

          {/* Skip notices */}
          <AnimatePresence>
            {skipNotices.length > 0 && (
              <div className="flex flex-col gap-2">
                {skipNotices.map((notice) => (
                  <Chip key={notice.id} tone="rose">
                    Skipped {notice.name}: not a supported document type
                  </Chip>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Drop zone */}
          <div
            {...dropProps}
            className={`wobble relative overflow-hidden border-2 border-dashed py-8 px-6 transition-colors duration-150 ${
              isDragOver ? 'border-[var(--line)] bg-rose/40' : 'border-[var(--line)] bg-transparent'
            }`}
          >
            <AnimatePresence>
              {isDragOver && (
                <motion.div
                  className="absolute top-0 left-0 right-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Stripe active className="rounded-none" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center gap-3">
              <motion.div
                animate={isDragOver ? { scale: 1.1, rotate: -4 } : { scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14 }}
              >
                <Tiger
                  state={
                    isDragOver
                      ? 'reading'
                      : sources.length === 0
                        ? 'cuddly'
                        : sources.some(s => s.status === 'queued' || s.status === 'rendering' || s.status === 'extracting')
                          ? 'idle'
                          : 'taking-notes'
                  }
                  size={96}
                />
              </motion.div>
              <p className="text-center font-display text-[22px] text-fg">
                {isDragOver ? 'Drop it, I will read it!' : 'Drop documents or images'}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">or</p>
              <GlassButton onClick={handleChooseFiles} variant="secondary" size="sm" icon={<Upload size={16} />}>
                Choose files
              </GlassButton>
            </div>
          </div>

          {/* Sources list */}
          {sources.length > 0 ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-3">
                {sources.length} {sources.length === 1 ? 'source' : 'sources'}
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {sources.map((source, idx) => (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22, delay: Math.min(idx * 0.04, 0.3) }}
                    >
                      <GlassCard className={`p-4 flex items-center gap-4 overflow-hidden ${idx % 2 ? "sketch-alt" : ""}`}>
                        <div className="shrink-0 flex items-center justify-center w-10 h-10 wobble-alt border-2 border-[var(--line)] bg-rose/40 font-mono text-[10px] uppercase tracking-[0.06em] text-fg -rotate-3">
                          {typeLabel(source)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-display text-[19px] text-fg truncate">{source.name}</p>
                          <p className="font-mono text-[11px] text-fg-faint mt-0.5">
                            {source.pages > 0 ? `${source.pages} ${source.pages === 1 ? 'page' : 'pages'} · ` : ''}
                            {formatFileSize(source.sizeBytes)} · {formatRelativeTime(source.addedAt)}
                          </p>
                          {source.note && <p className="text-[11px] text-fg-muted mt-0.5">{source.note}</p>}
                          {source.status === 'error' && source.error && (
                            <p className="text-[11px] text-danger mt-0.5">{source.error}</p>
                          )}
                        </div>

                        {rowTiger(source) && <Tiger state={rowTiger(source)!} size={32} />}

                        <StatusChip status={statusChipStatus[source.status]}>{statusLabel(source)}</StatusChip>

                        <div className="flex items-center gap-1 shrink-0">
                          <GlassButton
                            onClick={() => handlePreview(source.id)}
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            disabled={!source.text}
                            aria-label={`Preview ${source.name}`}
                          >
                            <Eye size={16} />
                          </GlassButton>
                          <GlassButton
                            onClick={() => handleRemove(source.id)}
                            variant="danger"
                            size="sm"
                            className="px-2"
                            aria-label={`Remove ${source.name}`}
                          >
                            <Trash2 size={16} />
                          </GlassButton>
                        </div>

                        {(source.status === 'rendering' || source.status === 'extracting') && (
                          <Stripe
                            active
                            className="absolute bottom-0 left-0 right-0 w-auto rounded-none"
                          />
                        )}
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <p className="font-display text-[19px] text-fg-muted text-center">No sources yet. Drop one above.</p>
          )}
        </div>
      </div>

      {/* Preview modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false)
          setTimeout(() => setSelectedSourceId(null), 200)
        }}
        title={selectedSource?.name}
        className="max-w-2xl"
      >
        {selectedSource && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">Type</p>
                <p className="font-mono text-sm text-fg">{typeLabel(selectedSource)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">Size</p>
                <p className="font-mono text-sm text-fg">{formatFileSize(selectedSource.sizeBytes)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">Pages</p>
                <p className="font-mono text-sm text-fg">{selectedSource.pages || '—'}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">Status</p>
                <StatusChip status={statusChipStatus[selectedSource.status]}>{statusLabel(selectedSource)}</StatusChip>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Extracted text</p>
                <GlassButton onClick={handleCopyText} variant="secondary" size="sm" disabled={!selectedSource.text}>
                  {copied ? 'Copied' : 'Copy text'}
                </GlassButton>
              </div>
              <div className="sketch-alt p-4 max-h-[60vh] overflow-auto">
                <p className="font-mono text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                  {selectedSource.text}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
