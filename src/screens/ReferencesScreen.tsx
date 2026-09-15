import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload, Trash2, Eye } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { GlassCard, GlassButton, StatusChip, Stripe, Modal, Chip } from '../components/ui'
import {
  kindFromName,
  processSource,
  type Source,
  type SourceInput,
  type SourceKind,
} from '../lib/sources'
import { useSettings } from '../lib/settings'
import { isTauri } from '../lib/tauri'

const typeLabel: Record<SourceKind, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  image: 'IMG',
}

const FILE_DIALOG_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'bmp', 'docx']
const FILE_INPUT_ACCEPT = FILE_DIALOG_EXTENSIONS.map((ext) => `.${ext}`).join(',')

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

  const [sources, setSources] = useState<Source[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [skipNotices, setSkipNotices] = useState<SkipNotice[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Mirrors `sources` so the (non-React) queue runner always sees fresh state without
  // needing to be re-created on every state change. Synced from a plain effect below —
  // never mutated inside a state updater, which React may invoke more than once
  // (e.g. under StrictMode) and would desync the mirror from what actually committed.
  const sourcesRef = useRef<Source[]>([])
  useEffect(() => {
    sourcesRef.current = sources
  }, [sources])

  // Original file/path input for each source, keyed by id — needed to (re)invoke processSource.
  const inputsRef = useRef<Record<string, SourceInput>>({})
  // FIFO order sources were added in, independent of the newest-first display order.
  const processingOrderRef = useRef<string[]>([])
  const abortControllersRef = useRef<Record<string, AbortController>>({})
  const processingIdRef = useRef<string | null>(null)

  const updateSource = useCallback((id: string, patch: Partial<Source>) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const startProcessing = useCallback(
    async (id: string, ocrTag: string) => {
      const input = inputsRef.current[id]
      if (!input) return

      processingIdRef.current = id
      const controller = new AbortController()
      abortControllersRef.current[id] = controller

      await processSource(input, ocrTag, (patch) => updateSource(id, patch), controller.signal)

      delete abortControllersRef.current[id]
      processingIdRef.current = null
      // Nudge `sources` so the queue-advance effect below re-runs even when this source
      // was aborted (processSource returns early on abort without calling onUpdate, so
      // the array wouldn't otherwise change).
      setSources((prev) => [...prev])
    },
    [updateSource],
  )

  const runQueue = useCallback(() => {
    if (processingIdRef.current) return
    const ocrTag = settings.ocrTag

    for (const id of processingOrderRef.current) {
      const source = sourcesRef.current.find((s) => s.id === id)
      if (!source || source.status !== 'queued') continue
      if ((source.kind === 'pdf' || source.kind === 'image') && !ocrTag) continue

      void startProcessing(id, ocrTag ?? '')
      return
    }
  }, [settings.ocrTag, startProcessing])

  // Re-check the queue whenever a source is added/updated/removed, or the OCR model
  // (settings.ocrTag, part of runQueue's identity) changes.
  useEffect(() => {
    runQueue()
  }, [sources, runQueue])

  const addSkipNotice = useCallback((name: string) => {
    const id = crypto.randomUUID()
    setSkipNotices((prev) => [...prev, { id, name }])
    setTimeout(() => {
      setSkipNotices((prev) => prev.filter((n) => n.id !== id))
    }, 4000)
  }, [])

  const addFiles = useCallback(
    async (inputs: SourceInput[]) => {
      for (const input of inputs) {
        const name = 'file' in input ? input.file.name : (input.path.split(/[\\/]/).pop() ?? input.path)
        const kind = kindFromName(name)
        if (!kind) {
          addSkipNotice(name)
          continue
        }

        let sizeBytes = 0
        if ('file' in input) {
          sizeBytes = input.file.size
        } else {
          try {
            sizeBytes = await invoke<number>('file_size', { path: input.path })
          } catch {
            sizeBytes = 0
          }
        }

        const id = crypto.randomUUID()
        inputsRef.current[id] = input
        processingOrderRef.current.push(id)

        const source: Source = {
          id,
          name,
          kind,
          sizeBytes,
          addedAt: new Date(),
          status: 'queued',
          progress: { page: 0, pages: 0 },
          pages: 0,
          text: '',
        }
        setSources((prev) => [source, ...prev])
      }
      // No explicit queue kick needed here — the `sources` effect above re-runs
      // runQueue() once these additions commit.
    },
    [addSkipNotice],
  )

  const handleRemove = useCallback((id: string) => {
    abortControllersRef.current[id]?.abort()
    delete abortControllersRef.current[id]
    delete inputsRef.current[id]
    processingOrderRef.current = processingOrderRef.current.filter((pid) => pid !== id)
    setSources((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handlePreview = useCallback((id: string) => {
    setSelectedSourceId(id)
    setIsPreviewOpen(true)
    setCopied(false)
  }, [])

  // --- Choose files ---------------------------------------------------

  const handleChooseFiles = useCallback(async () => {
    if (isTauri()) {
      const selected = await openFileDialog({
        multiple: true,
        filters: [{ name: 'Documents', extensions: FILE_DIALOG_EXTENSIONS }],
      })
      if (!selected) return
      const paths = Array.isArray(selected) ? selected : [selected]
      await addFiles(paths.map((path) => ({ path })))
      return
    }
    fileInputRef.current?.click()
  }, [addFiles])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        void addFiles(Array.from(files).map((file) => ({ file })))
      }
      e.target.value = ''
    },
    [addFiles],
  )

  // --- Drag and drop ----------------------------------------------------

  useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | undefined
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'enter' || payload.type === 'over') {
          setIsDragOver(true)
        } else if (payload.type === 'drop') {
          setIsDragOver(false)
          void addFiles(payload.paths.map((path) => ({ path })))
        } else if (payload.type === 'leave') {
          setIsDragOver(false)
        }
      })
      .then((fn) => {
        unlisten = fn
      })

    return () => unlisten?.()
  }, [addFiles])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isTauri()) return
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    if (isTauri()) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isTauri()) return
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      void addFiles(Array.from(files).map((file) => ({ file })))
    }
  }

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
      <div className="p-6 border-b border-line">
        <h1 className="font-display font-bold text-[28px] tracking-[-0.02em] text-fg mb-1.5">Sources</h1>
        <p className="text-sm text-fg-muted">Everything the paper will be built on. Text is extracted on this Mac.</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {needsOcrModel && (
            <div className="flex items-center justify-between gap-4 rounded-[var(--r-md)] border border-tiger/30 bg-tiger/10 px-4 py-3">
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
                    Skipped {notice.name}: not a PDF, image or DOCX
                  </Chip>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-[var(--r-lg)] border-2 border-dashed py-10 px-6 transition-colors duration-150 ${
              isDragOver ? 'border-tiger' : 'border-line'
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
                  <Stripe active className="rounded-none rounded-t-[var(--r-lg)]" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-tiger/15">
                <Upload size={20} className="text-tiger" />
              </div>
              <p className="text-center text-sm font-medium text-fg">Drop PDFs, DOCX or images</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">or</p>
              <GlassButton onClick={handleChooseFiles} variant="secondary" size="sm">
                Choose files
              </GlassButton>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={FILE_INPUT_ACCEPT}
                onChange={handleFileInputChange}
                className="hidden"
              />
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.3) }}
                    >
                      <GlassCard className="p-4 flex items-center gap-4">
                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--r-sm)] bg-[var(--panel-2)] font-mono text-[10px] uppercase tracking-[0.06em] text-fg-muted">
                          {typeLabel[source.kind]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-fg truncate">{source.name}</p>
                          <p className="font-mono text-[11px] text-fg-faint mt-0.5">
                            {source.pages > 0 ? `${source.pages} ${source.pages === 1 ? 'page' : 'pages'} · ` : ''}
                            {formatFileSize(source.sizeBytes)} · {formatRelativeTime(source.addedAt)}
                          </p>
                          {source.status === 'error' && source.error && (
                            <p className="text-[11px] text-rose mt-0.5">{source.error}</p>
                          )}
                        </div>

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
                            className="absolute bottom-0 left-0 right-0 w-auto rounded-none rounded-b-[var(--r-lg)]"
                          />
                        )}
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No sources yet. Drop one above.</p>
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
                <p className="font-mono text-sm text-fg">{typeLabel[selectedSource.kind]}</p>
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
              <div className="bg-[var(--panel-2)] rounded-[var(--r-md)] p-4 max-h-[60vh] overflow-auto">
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
