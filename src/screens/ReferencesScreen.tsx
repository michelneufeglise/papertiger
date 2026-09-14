import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Trash2, Eye } from 'lucide-react'
import { GlassCard, GlassButton, StatusChip, Stripe, Modal } from '../components/ui'
import { mockReferences, formatFileSize } from '../mock/references'
import type { Reference } from '../mock/references'

const typeLabel: Record<Reference['type'], string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  image: 'IMG',
}

const statusLabel: Record<Reference['ocrStatus'], string> = {
  idle: 'Idle',
  processing: 'Extracting',
  success: 'Extracted',
  error: 'Error',
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

export const ReferencesScreen: React.FC = () => {
  const [references, setReferences] = useState<Reference[]>(mockReferences)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const addMockReference = (ref: Reference, finalText: string) => {
    setReferences(prev => [ref, ...prev])

    // Simulate on-device OCR extraction completing.
    setTimeout(() => {
      setReferences(prev =>
        prev.map(r =>
          r.id === ref.id
            ? {
                ...r,
                ocrStatus: 'success',
                extractedText: finalText,
              }
            : r
        )
      )
    }, 2000)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    addMockReference(
      {
        id: `ref-${Date.now()}`,
        name: 'New_Research_Paper.pdf',
        type: 'pdf',
        size: Math.floor(Math.random() * 3000000) + 500000,
        pages: Math.floor(Math.random() * 60) + 10,
        extractedText: 'Extracting text on-device…',
        ocrStatus: 'processing',
        uploadedAt: new Date(),
      },
      'Recent advances in machine learning have demonstrated significant potential in various applications. This document explores the current state-of-the-art approaches and their practical implementations across different domains.'
    )
  }

  const handleChooseFiles = () => {
    addMockReference(
      {
        id: `ref-${Date.now()}`,
        name: 'New_Research_Document.docx',
        type: 'docx',
        size: 1500000,
        pages: 25,
        extractedText: 'Extracting text on-device…',
        ocrStatus: 'processing',
        uploadedAt: new Date(),
      },
      'Patient data from electronic health records was processed and analyzed. Statistical analysis revealed significant correlations between variables. The results suggest potential clinical applications.'
    )
  }

  const handleRemoveReference = (id: string) => {
    setReferences(prev => prev.filter(ref => ref.id !== id))
  }

  const handlePreview = (ref: Reference) => {
    setSelectedReference(ref)
    setIsPreviewOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-line">
        <h1 className="font-display font-bold text-[28px] tracking-[-0.02em] text-fg mb-1.5">
          Sources
        </h1>
        <p className="text-sm text-fg-muted">
          Everything the paper will be built on. Text is extracted on-device.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
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
              <p className="text-center text-sm font-medium text-fg">
                Drop PDFs, DOCX or images
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">
                or
              </p>
              <GlassButton onClick={handleChooseFiles} variant="secondary" size="sm">
                Choose files
              </GlassButton>
            </div>
          </div>

          {/* Sources list */}
          {references.length > 0 ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-3">
                {references.length} {references.length === 1 ? 'source' : 'sources'}
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {references.map((ref, idx) => (
                    <motion.div
                      key={ref.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.3) }}
                    >
                      <GlassCard className="p-4 flex items-center gap-4">
                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--r-sm)] bg-[var(--panel-2)] font-mono text-[10px] uppercase tracking-[0.06em] text-fg-muted">
                          {typeLabel[ref.type]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-fg truncate">{ref.name}</p>
                          <p className="font-mono text-[11px] text-fg-faint mt-0.5">
                            {ref.pages} pages · {formatFileSize(ref.size)} · {formatRelativeTime(ref.uploadedAt)}
                          </p>
                        </div>

                        <StatusChip status={ref.ocrStatus}>{statusLabel[ref.ocrStatus]}</StatusChip>

                        <div className="flex items-center gap-1 shrink-0">
                          <GlassButton
                            onClick={() => handlePreview(ref)}
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            aria-label={`Preview ${ref.name}`}
                          >
                            <Eye size={16} />
                          </GlassButton>
                          <GlassButton
                            onClick={() => handleRemoveReference(ref.id)}
                            variant="danger"
                            size="sm"
                            className="px-2"
                            aria-label={`Remove ${ref.name}`}
                          >
                            <Trash2 size={16} />
                          </GlassButton>
                        </div>

                        {ref.ocrStatus === 'processing' && (
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
          setTimeout(() => setSelectedReference(null), 200)
        }}
        title={selectedReference?.name}
        className="max-w-2xl"
      >
        {selectedReference && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">
                  Type
                </p>
                <p className="font-mono text-sm text-fg">{typeLabel[selectedReference.type]}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">
                  Size
                </p>
                <p className="font-mono text-sm text-fg">{formatFileSize(selectedReference.size)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">
                  Pages
                </p>
                <p className="font-mono text-sm text-fg">{selectedReference.pages}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-1">
                  OCR
                </p>
                <StatusChip status={selectedReference.ocrStatus}>
                  {statusLabel[selectedReference.ocrStatus]}
                </StatusChip>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-2">
                Extracted text
              </p>
              <div className="bg-[var(--panel-2)] rounded-[var(--r-md)] p-4 max-h-64 overflow-auto">
                <p className="text-sm text-fg-muted leading-relaxed">
                  {selectedReference.extractedText}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
