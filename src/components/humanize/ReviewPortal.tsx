import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { GlassButton } from '../ui'
import {
  useHumanize,
  effectiveOutputs,
  unresolvedFlags,
  setDecision,
  keepAll,
  revertAll,
  type DocJob,
} from '../../lib/humanizeStore'
import { diffWords } from '../../lib/humanize/diff'
import type { Block } from '../../lib/humanize/segment'

const MONO = 'font-mono text-[11px] uppercase tracking-[0.08em]'
const DEL_TINT = 'bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]'

/** Full text of a flagged block's rejected rewrite (the stored text is the body only). */
function rebuild(block: Block, body: string): string {
  return block.prefix ? block.prefix + (block.sep || ' ') + body : body
}

type ChipKind = 'kept' | 'reverted' | 'edited' | 'guard'

const CHIP_LABEL: Record<ChipKind, string> = {
  kept: 'Rewrite kept',
  reverted: 'Reverted',
  edited: 'Edited',
  guard: 'Kept by guard',
}

const DiffLeft: React.FC<{ original: string; other: string }> = ({ original, other }) => {
  const parts = useMemo(() => diffWords(original, other), [original, other])
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'ins' ? null : p.type === 'del' ? (
          <span key={i} className="line-through decoration-2 decoration-[var(--danger)] text-danger">
            {p.text}
          </span>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </>
  )
}

const DiffRight: React.FC<{ original: string; other: string }> = ({ original, other }) => {
  const parts = useMemo(() => diffWords(original, other), [original, other])
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'del' ? null : p.type === 'ins' ? (
          <mark key={i} className="bg-rose/70 text-fg rounded-sm px-0.5">
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </>
  )
}

const Editor: React.FC<{
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}> = ({ initial, onSave, onCancel }) => {
  const [text, setText] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [text])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          }
        }}
        aria-label="Edit the humanized text"
        rows={3}
        className="wobble w-full resize-none border-2 border-[var(--line)] bg-panel p-2.5 text-[15px] leading-relaxed text-fg focus:outline-none focus:shadow-[2px_3px_0_var(--line)]"
      />
      <div className="flex gap-2">
        <GlassButton size="sm" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          Save
        </GlassButton>
        <GlassButton size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </GlassButton>
      </div>
    </div>
  )
}

const Row: React.FC<{
  job: DocJob
  block: Block
  current: string
}> = ({ job, block, current }) => {
  const idx = block.idx
  const [editing, setEditing] = useState(false)
  const flagged = job.flagged.find(f => f.idx === idx)
  const decision = job.decisions[idx]
  const rejectedBody = job.rejected[idx] ?? ''
  const showRejected = !!flagged && !decision && rejectedBody.trim() !== ''
  const rejectedFull = showRejected ? rebuild(block, rejectedBody) : ''
  const shown = showRejected ? rejectedFull : current

  const kind: ChipKind =
    decision?.kind === 'edit' ? 'edited' : decision?.kind === 'revert' ? 'reverted' : flagged ? 'guard' : 'kept'

  return (
    <li className="py-4 border-b-2 border-dashed border-[var(--line-soft)] last:border-b-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
        <div className={clsx('wobble px-3 py-2.5 text-[15px] leading-relaxed text-fg whitespace-pre-wrap', DEL_TINT)}>
          <DiffLeft original={block.text} other={shown} />
        </div>
        <div className="px-1 py-2.5 text-[15px] leading-relaxed text-fg whitespace-pre-wrap">
          {editing ? (
            <Editor
              initial={current}
              onCancel={() => setEditing(false)}
              onSave={text => {
                setDecision(job.sourceId, idx, { kind: 'edit', text })
                setEditing(false)
              }}
            />
          ) : (
            <>
              {showRejected && <span className={clsx(MONO, 'block mb-1 text-fg-faint')}>Rejected rewrite</span>}
              <DiffRight original={block.text} other={shown} />
            </>
          )}
        </div>
      </div>

      {flagged && flagged.issues.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-fg-muted">{flagged.issues.join('; ')}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'wobble inline-flex items-center border-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
            kind === 'kept' && 'border-[var(--line-soft)] bg-panel-2 text-fg-muted',
            kind === 'reverted' && 'border-[var(--line)] bg-panel text-fg',
            kind === 'edited' && 'border-[var(--line)] bg-rose/50 text-fg',
            kind === 'guard' && 'border-danger text-danger',
          )}
        >
          {CHIP_LABEL[kind]}
        </span>
        <GlassButton
          size="sm"
          variant="secondary"
          disabled={!decision}
          onClick={() => setDecision(job.sourceId, idx, null)}
        >
          Keep
        </GlassButton>
        <GlassButton
          size="sm"
          variant="secondary"
          disabled={decision?.kind === 'revert'}
          onClick={() => {
            setEditing(false)
            setDecision(job.sourceId, idx, { kind: 'revert' })
          }}
        >
          Revert
        </GlassButton>
        <GlassButton size="sm" variant="secondary" disabled={editing} onClick={() => setEditing(true)}>
          Edit
        </GlassButton>
        {showRejected && (
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={() => setDecision(job.sourceId, idx, { kind: 'edit', text: rejectedFull })}
          >
            Use rewrite anyway
          </GlassButton>
        )}
      </div>
    </li>
  )
}

export interface ReviewPortalProps {
  sourceId: string
  onClose: () => void
}

export const ReviewPortal: React.FC<ReviewPortalProps> = ({ sourceId, onClose }) => {
  const h = useHumanize()
  const job = h.jobs[sourceId]
  const reduce = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const titleId = `review-title-${sourceId}`

  useEffect(() => {
    sheetRef.current?.focus()
    const o = opener.current
    return () => {
      if (o instanceof HTMLElement) o.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const eff = useMemo(() => (job ? effectiveOutputs(job) : {}), [job])

  const stats = useMemo(() => {
    if (!job) return { changed: 0, reverted: 0, edited: 0, guard: 0 }
    let changed = 0
    for (const b of job.blocks) {
      if (b.rewrite && eff[b.idx] !== undefined && eff[b.idx] !== b.text) changed++
    }
    const ds = Object.values(job.decisions)
    return {
      changed,
      reverted: ds.filter(d => d.kind === 'revert').length,
      edited: ds.filter(d => d.kind === 'edit').length,
      guard: unresolvedFlags(job).length,
    }
  }, [job, eff])

  const rows = useMemo(() => {
    if (!job) return []
    const out: { block: Block; context: boolean }[] = []
    for (const b of job.blocks) {
      if (b.kind === 'empty' || !b.text.trim()) continue
      const rw = job.rewrites[b.idx]
      const flagged = job.flagged.some(f => f.idx === b.idx)
      const reviewable = b.rewrite && ((rw !== undefined && rw !== b.text) || flagged)
      if (reviewable) out.push({ block: b, context: false })
      else if (showUnchanged) out.push({ block: b, context: true })
    }
    return out
  }, [job, showUnchanged])

  if (!job || typeof document === 'undefined') return null

  const dur = reduce ? 0 : undefined

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 bg-[#2a2522]/45 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        transition={{ duration: reduce ? 0 : 0.15 }}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <motion.div
          ref={sheetRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="sketch pointer-events-auto flex flex-col w-[92vw] h-[88vh] max-w-[1200px] focus:outline-none overflow-hidden"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 14, rotate: -1 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8, rotate: 0.5 }}
          transition={reduce ? { duration: dur } : { type: 'spring', stiffness: 420, damping: 26 }}
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4 border-b-2 border-dashed border-[var(--line-soft)]">
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="font-display text-[24px] text-fg min-w-0 truncate">
                Review · {job.title}
              </h2>
              <button
                type="button"
                aria-label="Close review"
                onClick={onClose}
                className="shrink-0 p-1.5 text-fg-muted hover:text-fg hover:bg-rose/40 wobble transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <p className="font-mono text-[12px] text-fg-muted">
                {stats.changed} changed · {stats.reverted} reverted · {stats.edited} edited · {stats.guard} kept by
                the guard
              </p>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <label className="flex items-center gap-2 cursor-pointer select-none font-mono text-[12px] text-fg-muted">
                  <input
                    type="checkbox"
                    className="accent-[var(--line)] h-4 w-4"
                    checked={showUnchanged}
                    onChange={e => setShowUnchanged(e.target.checked)}
                  />
                  Show unchanged blocks
                </label>
                <GlassButton size="sm" variant="secondary" onClick={() => keepAll(sourceId)}>
                  Keep all
                </GlassButton>
                <GlassButton size="sm" variant="secondary" onClick={() => revertAll(sourceId)}>
                  Revert all
                </GlassButton>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
            <div className="sticky top-0 z-10 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 bg-[var(--panel)] py-2.5 border-b-2 border-[var(--line-soft)]">
              <p className={clsx(MONO, 'text-fg-faint')}>Original</p>
              <p className={clsx(MONO, 'text-fg-faint hidden md:block')}>Humanized</p>
            </div>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-fg-muted">
                {job.status === 'running' || job.status === 'queued'
                  ? 'Blocks will show up here as they are rewritten.'
                  : 'No block was changed.'}
              </p>
            ) : (
              <ul>
                {rows.map(({ block, context }) =>
                  context ? (
                    <li
                      key={block.idx}
                      className="py-3 border-b-2 border-dashed border-[var(--line-soft)] last:border-b-0 opacity-60"
                    >
                      <p
                        className={clsx(
                          'whitespace-pre-wrap text-fg',
                          block.kind === 'heading' ? 'font-display text-[19px]' : 'text-[14px] leading-relaxed',
                        )}
                      >
                        {block.text}
                      </p>
                    </li>
                  ) : (
                    <Row key={block.idx} job={job} block={block} current={eff[block.idx] ?? block.text} />
                  ),
                )}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-end px-6 py-3 border-t-2 border-dashed border-[var(--line-soft)]">
            <GlassButton onClick={onClose}>Done</GlassButton>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  )
}
