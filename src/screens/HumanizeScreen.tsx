import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { Wand2, Copy, Download, Trash2, X, Check } from 'lucide-react'
import { GlassCard, GlassButton, Stripe, Tiger } from '../components/ui'
import {
  useHumanize,
  startBatch,
  cancelBatch,
  clearSelection,
  clearJobs,
  toggleSelected,
  selectAll,
  setManualReview,
  effectiveOutputs,
  unresolvedFlags,
  setTone,
  setStrength,
  type Tone,
  type Strength,
  type DocJob,
} from '../lib/humanizeStore'
import { useSources } from '../lib/sourcesStore'
import { ReviewPortal } from '../components/humanize/ReviewPortal'
import { useSettings } from '../lib/settings'
import { toView, renderMarkdown } from '../lib/humanize/render'
import type { Block } from '../lib/humanize/segment'
import { buildHumanizedDocx, saveHumanizedDocx } from '../lib/humanize/docx'

const TONES: { id: Tone; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'casual', label: 'Casual' },
  { id: 'professional', label: 'Professional' },
  { id: 'academic', label: 'Academic' },
]

const STRENGTHS: { id: Strength; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Smooth AI tics' },
  { id: 'medium', label: 'Medium', hint: 'Rework sentences' },
  { id: 'heavy', label: 'Heavy', hint: 'Free rewrite' },
]

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint'

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const NO_BLOCKS: Block[] = []
const NO_OUTPUTS: Record<number, string> = {}

const HEADING_SIZE = ['text-[30px]', 'text-[26px]', 'text-[22px]', 'text-[19px]']

/** Left border that marks rewritten text; the draft and kept blocks stay plain. */
const REWRITTEN = 'border-l-2 border-rose pl-3'

interface CardSource {
  id: string
  name: string
  text: string
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

function changedCount(job: DocJob, outputs: Record<number, string>): number {
  let n = 0
  for (const b of job.blocks) if (b.rewrite && outputs[b.idx] !== undefined && outputs[b.idx] !== b.text) n++
  return n
}

const STATUS_BASE =
  'wobble inline-flex items-center gap-1 border-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] whitespace-nowrap'

const StatusBadge: React.FC<{ job?: DocJob }> = ({ job }) => {
  if (!job) return null
  if (job.status === 'queued') return <span className={clsx(STATUS_BASE, 'border-[var(--line-soft)] bg-panel-2 text-fg-muted')}>Queued</span>
  if (job.status === 'running')
    return (
      <span className={clsx(STATUS_BASE, 'border-[var(--line)] bg-rose/50 text-fg')}>
        Humanizing {job.i}/{job.of}
      </span>
    )
  if (job.status === 'done')
    return unresolvedFlags(job).length > 0 ? (
      <span className={clsx(STATUS_BASE, 'border-[var(--line)] bg-rose/50 text-fg')}>{unresolvedFlags(job).length} kept</span>
    ) : (
      <span className={clsx(STATUS_BASE, 'border-mint text-mint bg-mint/20')}>
        {Object.keys(job.decisions).length > 0 ? 'Reviewed' : 'Done'}
      </span>
    )
  if (job.status === 'cancelled') return <span className={clsx(STATUS_BASE, 'border-[var(--line-soft)] bg-panel-2 text-fg-muted')}>Cancelled</span>
  return <span className={clsx(STATUS_BASE, 'border-danger text-danger')}>Error</span>
}

const PreviewCard: React.FC<{
  source: CardSource
  job?: DocJob
  index: number
  active: boolean
  dimmed: boolean
  manualReview: boolean
  onActivate: () => void
  onReview: (el: HTMLElement) => void
}> = ({ source, job, index, active, dimmed, manualReview, onActivate, onReview }) => {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  const outputs = useMemo(() => (job ? effectiveOutputs(job) : NO_OUTPUTS), [job?.rewrites, job?.decisions]) // eslint-disable-line react-hooks/exhaustive-deps
  const running = job?.status === 'running'
  const hasOutput = Object.keys(outputs).length > 0
  const finished = job?.status === 'done' || job?.status === 'cancelled'

  const preview = useMemo(() => {
    if (!job || job.blocks.length === 0) return source.text.slice(0, 900)
    let o = outputs
    if (running && job.currentIdx !== null && job.draft) o = { ...outputs, [job.currentIdx]: job.draft }
    return renderMarkdown(job.blocks, o).slice(0, 900)
  }, [job, outputs, running, source.text])

  const words = wordCount(source.text)
  const changed = job && job.blocks.length ? changedCount(job, outputs) : 0
  const reviewed = job ? Object.keys(job.decisions).length : 0

  const doCopy = async () => {
    if (!job) return
    try {
      await navigator.clipboard.writeText(renderMarkdown(job.blocks, outputs))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard denied.
    }
  }

  const doDocx = async () => {
    if (!job) return
    setExporting(true)
    try {
      const blob = await buildHumanizedDocx(job.title, job.blocks, outputs)
      await saveHumanizedDocx(blob, `${job.title} (humanized).docx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className={clsx(
        'relative sketch-alt flex flex-col min-w-0 transition-opacity',
        dimmed && 'opacity-60',
        active && 'outline outline-[3px] outline-rose outline-offset-2',
      )}
      style={{ rotate: index % 2 === 0 ? '-0.6deg' : '0.6deg' }}
    >
      <div
        aria-hidden="true"
        className="absolute -top-2 left-1/2 z-10 h-4 w-16 -translate-x-1/2 -rotate-2 border border-[var(--line-soft)]"
        style={{ background: 'color-mix(in srgb, var(--rose) 60%, transparent)' }}
      />
      <button
        type="button"
        aria-pressed={active}
        onClick={onActivate}
        className="text-left flex-1 min-w-0 px-4 pt-5 pb-2 focus-visible:outline-none focus-visible:bg-rose/20"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block font-display text-[17px] leading-tight text-fg truncate">
              {job?.title || stripExt(source.name)}
            </span>
            <span className="block font-mono text-[11px] text-fg-faint">{words.toLocaleString()} words</span>
          </span>
          <StatusBadge job={job} />
        </span>
        {running && <Stripe active className="mt-2" />}
        <span className="relative mt-2.5 block h-[11.5rem] overflow-hidden">
          <span
            className={clsx(
              'block whitespace-pre-line break-words text-[12px] leading-[1.45] text-fg',
              running && 'text-fg-muted',
            )}
          >
            {preview}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--panel)] to-transparent"
          />
        </span>
        {job?.status === 'done' && (
          <span className="block font-mono text-[11px] text-fg-muted mt-1">
            {changed} of {job.of} blocks changed
          </span>
        )}
        {job?.status === 'error' && job.error && (
          <span className="block font-mono text-[11px] text-danger mt-1">{job.error}</span>
        )}
      </button>

      {finished && hasOutput && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-1">
          <GlassButton size="sm" variant="secondary" icon={<Copy size={14} />} onClick={doCopy}>
            {copied ? 'Copied' : 'Copy'}
          </GlassButton>
          <GlassButton
            size="sm"
            variant="secondary"
            icon={<Download size={14} />}
            disabled={exporting}
            onClick={doDocx}
          >
            .docx
          </GlassButton>
          {manualReview && (
            <GlassButton size="sm" variant="primary" onClick={e => onReview(e.currentTarget)}>
              Review{reviewed > 0 ? ` · ${reviewed} reviewed` : ''}
            </GlassButton>
          )}
        </div>
      )}
    </div>
  )
}

const ManualReviewBox: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
    <input
      type="checkbox"
      className="peer sr-only"
      checked={on}
      onChange={e => onChange(e.target.checked)}
    />
    <span
      aria-hidden="true"
      className={clsx(
        'wobble h-6 w-6 shrink-0 border-2 border-[var(--line)] flex items-center justify-center transition-colors',
        'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-rose peer-focus-visible:outline-offset-2',
        on ? 'bg-rose/50 shadow-[2px_3px_0_var(--line)]' : 'bg-panel',
      )}
    >
      {on && (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 12.5 C6 14, 8 17, 9.5 19.5 C12 12, 16 7, 21 3.5" />
        </svg>
      )}
    </span>
    <span className="text-sm text-fg">Manual review — check every change before using it</span>
  </label>
)

export const HumanizeScreen: React.FC = () => {
  const navigate = useNavigate()
  const settings = useSettings()
  const sources = useSources()
  const h = useHumanize()

  const doneSources = useMemo(() => sources.filter(s => s.status === 'done' && s.text.trim()), [sources])
  const running = h.runningId !== null
  const noWriter = settings.writerTag === null

  const selectedValid = useMemo(() => h.selected.filter(id => doneSources.some(s => s.id === id)), [h.selected, doneSources])
  const selectedWords = useMemo(
    () => selectedValid.reduce((n, id) => n + wordCount(doneSources.find(s => s.id === id)?.text ?? ''), 0),
    [selectedValid, doneSources],
  )

  // Cards: the selected sources in pick order, then other jobs (dimmed).
  const cards = useMemo(() => {
    const out: { source: CardSource; dimmed: boolean }[] = []
    const seen = new Set<string>()
    const add = (id: string, dimmed: boolean) => {
      if (seen.has(id)) return
      const src = sources.find(s => s.id === id)
      const job = h.jobs[id]
      if (!src && !job) return
      seen.add(id)
      out.push({ source: { id, name: src?.name ?? job?.title ?? '', text: src?.text ?? '' }, dimmed })
    }
    for (const id of selectedValid) add(id, false)
    for (const id of h.order) add(id, true)
    return out
  }, [sources, selectedValid, h.order, h.jobs])

  const [userActive, setUserActive] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Follow the running document: adjust state during render when the running id changes.
  const [seenRunning, setSeenRunning] = useState<string | null>(null)
  if (h.runningId !== seenRunning) {
    setSeenRunning(h.runningId)
    if (h.runningId) setUserActive(h.runningId)
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const activeId = useMemo(() => {
    if (userActive && cards.some(c => c.source.id === userActive)) return userActive
    if (h.runningId) return h.runningId
    const done = cards.find(c => h.jobs[c.source.id]?.status === 'done' && !c.dimmed) ?? cards.find(c => h.jobs[c.source.id]?.status === 'done')
    return (done ?? cards[0])?.source.id ?? null
  }, [userActive, cards, h.runningId, h.jobs])

  const job = activeId ? h.jobs[activeId] : undefined
  const outputs = useMemo(() => (job ? effectiveOutputs(job) : NO_OUTPUTS), [job])
  const blocks = job?.blocks ?? NO_BLOCKS
  const title = job?.title ?? ''
  const draft = job?.draft ?? ''
  const currentIdx = job?.currentIdx ?? null
  const jobRunning = job?.status === 'running'
  const error = h.error

  const view = useMemo(() => toView(blocks, outputs), [blocks, outputs])
  const hasOutput = Object.keys(outputs).length > 0

  // Progress across the batch: new batch ids sit first in `order`.
  const runJob = h.runningId ? h.jobs[h.runningId] : undefined
  const batchN = useMemo(() => {
    let last = -1
    h.order.forEach((id, i) => {
      const st = h.jobs[id]?.status
      if (st === 'queued' || st === 'running') last = i
    })
    return last + 1
  }, [h.order, h.jobs])
  const batchK = h.runningId ? h.order.indexOf(h.runningId) + 1 : 0

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderMarkdown(blocks, outputs))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard denied: the button just doesn't flip to "Copied".
    }
  }, [blocks, outputs])

  const handleDocx = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await buildHumanizedDocx(title, blocks, outputs)
      await saveHumanizedDocx(blob, `${title} (humanized).docx`)
    } finally {
      setExporting(false)
    }
  }, [title, blocks, outputs])

  const elapsed = runJob?.startedAt ? formatElapsed(now - runJob.startedAt) : '0s'
  const preparing = (runJob?.i ?? 0) === 0
  const pct = Math.max(2, Math.round((100 * ((runJob?.i ?? 1) - 1)) / Math.max(1, runJob?.of ?? 1)))

  const closeReview = useCallback(() => {
    setReviewId(null)
    openerRef.current?.focus()
  }, [])

  /** Text of one rewritable block: live draft while it is being written, else its text. */
  const renderText = (idx: number, text: string, rewrite: boolean): React.ReactNode => {
    if (jobRunning && currentIdx === idx) {
      return draft ? (
        <span className="italic text-fg-muted">{draft}</span>
      ) : (
        <span className="text-fg-faint">
          {text}
          <span className="caret-blink ml-0.5">|</span>
        </span>
      )
    }
    if (rewrite && outputs[idx] !== undefined) {
      return <span className={clsx('inline-block', REWRITTEN)}>{text}</span>
    }
    return text
  }

  const linkBtn =
    'font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted underline decoration-dotted underline-offset-4 hover:text-fg disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 border-b-2 border-dashed border-[var(--line-soft)]">
        <h1 className="font-display text-[32px] text-fg mb-1.5">
          <span className="doodle-underline">Humanize</span>
        </h1>
        <p className="text-sm text-fg-muted max-w-3xl">
          Rewrite documents so they read like a person wrote them: varied rhythm, natural phrasing, no telltale AI
          tics. It works block by block: headings, labels and table headers stay as they are; facts, names,
          numbers and quotes are preserved.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Document picker */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className={LABEL}>Documents</p>
              {doneSources.length > 0 && (
                <>
                  <button type="button" className={linkBtn} disabled={running} onClick={selectAll}>
                    Select all
                  </button>
                  <span aria-hidden="true" className="text-fg-faint -mx-2">·</span>
                  <button type="button" className={linkBtn} disabled={running} onClick={clearSelection}>
                    Clear
                  </button>
                </>
              )}
            </div>
            {doneSources.length === 0 ? (
              <div className="wobble border-2 border-dashed border-[var(--line)] py-8 px-6 flex flex-col items-center gap-3">
                <Tiger state="cuddly" size={96} />
                <p className="font-display text-[20px] text-fg text-center">Nothing to humanize yet.</p>
                <p className="text-sm text-fg-muted text-center">Add a document in Sources and let it finish extracting.</p>
                <GlassButton variant="secondary" size="sm" onClick={() => navigate('/references')}>
                  Go to Sources
                </GlassButton>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Documents">
                  {doneSources.map(s => {
                    const on = selectedValid.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={running}
                        onClick={() => toggleSelected(s.id)}
                        className={clsx(
                          'wobble border-2 px-3.5 py-2 text-left max-w-full transition-colors flex items-center gap-2.5',
                          'disabled:opacity-60 disabled:pointer-events-none',
                          on
                            ? 'border-[var(--line)] bg-rose/50 shadow-[2px_3px_0_var(--line)]'
                            : 'border-[var(--line-soft)] bg-panel hover:bg-rose/30',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            'h-5 w-5 shrink-0 border-2 flex items-center justify-center wobble',
                            on ? 'border-[var(--line)] bg-panel' : 'border-[var(--line-soft)]',
                          )}
                        >
                          {on && <Check size={14} strokeWidth={3.5} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-[17px] text-fg truncate max-w-[320px]">{s.name}</span>
                          <span className="block font-mono text-[11px] text-fg-faint">
                            {wordCount(s.text).toLocaleString()} words
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 font-mono text-[12px] text-fg-muted">
                  {selectedValid.length} selected · {selectedWords.toLocaleString()} words
                </p>
              </>
            )}
          </section>

          {/* Tone */}
          <section>
            <p className={clsx(LABEL, 'mb-3')}>Tone</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Tone">
              {TONES.map(t => (
                <OptionButton
                  key={t.id}
                  on={h.tone === t.id}
                  disabled={running}
                  onClick={() => setTone(t.id)}
                  label={t.label}
                />
              ))}
            </div>
          </section>

          {/* Strength */}
          <section>
            <p className={clsx(LABEL, 'mb-3')}>Strength</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Strength">
              {STRENGTHS.map(s => (
                <OptionButton
                  key={s.id}
                  on={h.strength === s.id}
                  disabled={running}
                  onClick={() => setStrength(s.id)}
                  label={s.label}
                  hint={s.hint}
                />
              ))}
            </div>
          </section>

          {/* Manual review */}
          <section>
            <ManualReviewBox on={h.manualReview} onChange={setManualReview} />
          </section>

          {/* Run */}
          {noWriter ? (
            <div className="flex items-center justify-between gap-4 sketch-alt bg-rose/40 px-4 py-3">
              <p className="text-sm text-fg">Pick a writer model first</p>
              <GlassButton variant="secondary" size="sm" onClick={() => navigate('/setup?step=writer')}>
                Choose a writer
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-3">
              {running ? (
                <GlassButton variant="secondary" size="lg" icon={<X size={18} />} onClick={cancelBatch}>
                  Cancel
                </GlassButton>
              ) : (
                <GlassButton
                  size="lg"
                  icon={<Wand2 size={18} />}
                  disabled={selectedValid.length === 0}
                  onClick={() => void startBatch()}
                >
                  {selectedValid.length > 1 ? `Humanize ${selectedValid.length} documents` : 'Humanize'}
                </GlassButton>
              )}

              {running && (
                <div className="space-y-2">
                  <Stripe active />
                  <p className="font-mono text-[12px] text-fg-muted">
                    {preparing
                      ? `Document ${batchK} of ${batchN} · preparing…`
                      : `Document ${batchK} of ${batchN} · block ${runJob?.i ?? 0}/${runJob?.of ?? 0} · ${elapsed} · ${Math.round(runJob?.tokPerSec ?? 0)} tok/s`}
                  </p>
                  <div className="h-1.5 w-full rounded-full bg-panel-2 overflow-hidden border border-[var(--line-soft)]">
                    {preparing ? (
                      <div className="shimmer h-full w-full" />
                    ) : (
                      <div
                        className="h-full bg-[var(--line)] rounded-full transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="font-mono text-[12px] text-danger">{error}</p>}

          {/* Preview grid */}
          {cards.length > 0 && (
            <section aria-label="Documents preview">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 pt-2">
                {cards.map((c, i) => (
                  <PreviewCard
                    key={c.source.id}
                    source={c.source}
                    job={h.jobs[c.source.id]}
                    index={i}
                    active={c.source.id === activeId}
                    dimmed={c.dimmed}
                    manualReview={h.manualReview}
                    onActivate={() => setUserActive(c.source.id)}
                    onReview={el => {
                      openerRef.current = el
                      setReviewId(c.source.id)
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Result */}
          {blocks.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-dashed border-[var(--line-soft)]">
                <div className="flex items-center gap-3 min-w-0">
                  {jobRunning && <Tiger cycle size={48} />}
                  <div className="min-w-0">
                    <p className="font-display text-[18px] text-fg truncate">{title}</p>
                    <p className="font-mono text-[11px] text-fg-faint truncate">
                      {job?.model ? `via ${job.model}` : ''}
                    </p>
                  </div>
                </div>
                {!jobRunning && hasOutput && (
                  <div className="flex flex-wrap items-center gap-2">
                    <GlassButton variant="secondary" size="sm" icon={<Copy size={15} />} onClick={handleCopy}>
                      {copied ? 'Copied' : 'Copy'}
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<Download size={15} />}
                      disabled={exporting}
                      onClick={handleDocx}
                    >
                      Download .docx
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" icon={<Trash2 size={15} />} disabled={running} onClick={clearJobs}>
                      Clear
                    </GlassButton>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-[15px] leading-relaxed text-fg">
                {view.map(item => {
                  if (item.type === 'heading') {
                    return (
                      <h3
                        key={item.idx}
                        className={clsx('font-display text-fg pt-2', HEADING_SIZE[Math.min(item.level, 4) - 1] ?? 'text-[19px]')}
                      >
                        {item.text}
                      </h3>
                    )
                  }
                  if (item.type === 'para') {
                    return <p key={item.idx}>{renderText(item.idx, item.text, item.rewrite)}</p>
                  }
                  if (item.type === 'list') {
                    return (
                      <p key={item.idx} className="flex gap-2">
                        <span className="font-mono text-fg-muted shrink-0">{item.marker.trim()}</span>
                        <span>{renderText(item.idx, item.text, item.rewrite)}</span>
                      </p>
                    )
                  }
                  return (
                    <div key={`t${item.idx}`} className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {item.rows.map((row, r) => (
                            <tr key={r}>
                              {row.map((c, ci) => {
                                const Cell = r === 0 ? 'th' : 'td'
                                return (
                                  <Cell
                                    key={ci}
                                    className={clsx(
                                      'border border-[var(--line-soft)] px-2.5 py-1.5 text-left align-top',
                                      r === 0 && 'font-bold bg-panel-2',
                                    )}
                                  >
                                    {c.idx >= 0 ? renderText(c.idx, c.text, c.rewrite) : c.text}
                                  </Cell>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {/* Flagged note */}
          {job && unresolvedFlags(job).length > 0 && !jobRunning && (
            <details className="text-sm text-fg-muted">
              <summary className="cursor-pointer">
                {unresolvedFlags(job).length} {unresolvedFlags(job).length === 1 ? 'block' : 'blocks'} kept as in the original (the
                rewrite didn&apos;t pass the quality check)
              </summary>
              <ul className="mt-2 space-y-2 font-mono text-[11px]">
                {unresolvedFlags(job).map(f => (
                  <li key={f.idx} title={f.issues.join('; ')}>
                    <span className="text-fg">#{f.i}</span> {f.issues.join('; ')}
                    {f.preview ? <span className="block text-fg-faint truncate">{f.preview}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
      {reviewId && <ReviewPortal sourceId={reviewId} onClose={closeReview} />}
    </div>
  )
}

const OptionButton: React.FC<{
  on: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  hint?: string
}> = ({ on, disabled, onClick, label, hint }) => (
  <button
    role="radio"
    aria-checked={on}
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      'wobble border-2 px-3.5 py-2.5 text-left transition-colors',
      'disabled:opacity-60 disabled:pointer-events-none',
      on
        ? 'border-[var(--line)] bg-rose/50 shadow-[2px_3px_0_var(--line)]'
        : 'border-[var(--line-soft)] bg-panel hover:bg-rose/30',
    )}
  >
    <span className="block font-display text-[18px] text-fg">{label}</span>
    {hint && <span className="block font-mono text-[11px] text-fg-faint">{hint}</span>}
  </button>
)
