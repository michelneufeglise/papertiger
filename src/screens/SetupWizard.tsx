import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { CheckCircle2, ExternalLink, RefreshCw, Cpu, X } from 'lucide-react'

import { GlassCard, GlassButton, Chip, StatusChip, Tiger } from '../components/ui'
import type { TigerState } from '../lib/tiger'
import { getHardwareInfo, recommendQuant, recommendWriter, writerFit, type HardwareInfo, type Quant } from '../lib/hardware'
import { OCR_MODELS, WRITER_FAMILIES, WRITER_MODELS, writerById, type WriterFamily } from '../lib/models'
import { getStatus, hasModel, pullModel, type OllamaStatus, type PullProgress } from '../lib/ollama'
import { readSettings, updateSettings } from '../lib/settings'

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5

const STEP_LABELS = ['Welcome', 'Your Mac', 'OCR', 'Writer', 'Download', 'Done']

const WRITER_FAMILY_ORDER: WriterFamily[] = ['qwen', 'gemma', 'deepseek']

const fmtGb = (n: number) => n.toFixed(1)

type RowStatus = 'pending' | 'checking' | 'have' | 'pulling' | 'ready' | 'error'

interface DownloadRow {
  key: 'ocr' | 'writer'
  label: string
  tag: string
  downloadGb: number
}

interface WriterDecision {
  id: string | null
  tag: string | null
  skipped: boolean
}

const stepVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
}

const Stepper: React.FC<{ step: StepIndex }> = ({ step }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-8">
    {STEP_LABELS.map((label, i) => {
      const isCurrent = i === step
      const isDone = i < step
      return (
        <div
          key={label}
          className={clsx(
            'font-display text-[19px] leading-none px-1.5 py-1',
            isCurrent ? 'highlighter -rotate-2 text-fg' : isDone ? 'text-fg-muted line-through decoration-2' : 'text-fg-faint',
          )}
          aria-current={isCurrent ? 'step' : undefined}
        >
          {isCurrent ? <span className="doodle-underline">{label}</span> : label}
        </div>
      )
    })}
  </div>
)

const Heading: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h1 className={clsx('font-display text-[40px] leading-none text-fg', className)}>
    <span className="doodle-underline">{children}</span>
  </h1>
)

const StepTiger: React.FC<{ state: TigerState; size?: number; className?: string }> = ({ state, size = 96, className }) => (
  <Tiger state={state} size={size} className={clsx('shrink-0', className)} />
)

export const SetupWizard: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [startStep] = React.useState<StepIndex>(() => (searchParams.get('step') === 'writer' ? 3 : 0))
  const [step, setStep] = React.useState<StepIndex>(startStep)

  const [hw, setHw] = React.useState<HardwareInfo | null>(null)
  const [ollama, setOllama] = React.useState<OllamaStatus | null>(null)
  const [ollamaChecking, setOllamaChecking] = React.useState(true)

  const [selectedQuant, setSelectedQuant] = React.useState<Quant | null>(() => readSettings().ocrQuant)

  const [selectedWriterVariantId, setSelectedWriterVariantId] = React.useState<string | null>(
    () => readSettings().writerId,
  )
  const [writerDecision, setWriterDecision] = React.useState<WriterDecision>(() => {
    const s = readSettings()
    return { id: s.writerId, tag: s.writerTag, skipped: s.writerSkipped }
  })

  const [rowStatus, setRowStatus] = React.useState<Record<string, RowStatus>>({})
  const [rowProgress, setRowProgress] = React.useState<Record<string, PullProgress | null>>({})
  const [downloadError, setDownloadError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const reduce = useReducedMotion()
  const [welcomeState, setWelcomeState] = React.useState<TigerState>('waving-bye')
  React.useEffect(() => {
    if (step !== 0) return
    const t = window.setTimeout(() => setWelcomeState('happy'), 2200)
    return () => window.clearTimeout(t)
  }, [step])

  const recommendation = hw ? recommendQuant(hw) : null
  const effectiveQuant: Quant = selectedQuant ?? recommendation?.quant ?? 'q4'
  const effectiveModel = OCR_MODELS[effectiveQuant]

  const writerRecommendation = hw ? recommendWriter(hw) : null
  const effectiveWriterVariantId = selectedWriterVariantId ?? writerRecommendation?.id ?? null
  const writerModel = writerDecision.id ? writerById(writerDecision.id) : undefined

  // Fetch hardware + Ollama status once, as soon as the wizard mounts (also covers
  // entering directly on the Writer step via /setup?step=writer, where step 2 never ran).
  React.useEffect(() => {
    let cancelled = false
    getHardwareInfo().then((info) => {
      if (!cancelled) setHw(info)
    })
    getStatus().then((status) => {
      if (!cancelled) {
        setOllama(status)
        setOllamaChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const checkOllamaAgain = React.useCallback(async () => {
    setOllamaChecking(true)
    try {
      const status = await getStatus()
      setOllama(status)
    } finally {
      setOllamaChecking(false)
    }
  }, [])

  const selectQuant = (quant: Quant) => {
    setSelectedQuant(quant)
    updateSettings({ ocrQuant: quant, ocrTag: OCR_MODELS[quant].tag })
  }

  const confirmModel = () => {
    updateSettings({ ocrQuant: effectiveQuant, ocrTag: effectiveModel.tag })
    setStep(3)
  }

  const useThisWriter = () => {
    if (!effectiveWriterVariantId) return
    const model = writerById(effectiveWriterVariantId)
    if (!model) return
    updateSettings({ writerId: model.id, writerTag: model.tag, writerSkipped: false })
    setWriterDecision({ id: model.id, tag: model.tag, skipped: false })
    setStep(4)
  }

  const skipWriter = () => {
    updateSettings({ writerId: null, writerTag: null, writerSkipped: true })
    setWriterDecision({ id: null, tag: null, skipped: true })
    setStep(4)
  }

  const downloadRows = React.useMemo<DownloadRow[]>(() => {
    const rows: DownloadRow[] = [
      { key: 'ocr', label: effectiveModel.label, tag: effectiveModel.tag, downloadGb: effectiveModel.downloadGb },
    ]
    if (writerDecision.tag && writerModel) {
      rows.push({ key: 'writer', label: writerModel.label, tag: writerDecision.tag, downloadGb: writerModel.downloadGb })
    }
    return rows
  }, [effectiveModel, writerDecision.tag, writerModel])

  // Download step: pull rows sequentially (OCR, then writer if chosen).
  React.useEffect(() => {
    if (step !== 4) return
    let cancelled = false

    async function run() {
      setDownloadError(null)
      for (const row of downloadRows) {
        if (cancelled) return
        setRowStatus((s) => ({ ...s, [row.key]: 'checking' }))

        let already = false
        try {
          already = await hasModel(row.tag)
        } catch {
          already = false
        }
        if (cancelled) return

        if (already) {
          setRowStatus((s) => ({ ...s, [row.key]: 'have' }))
          continue
        }

        setRowStatus((s) => ({ ...s, [row.key]: 'pulling' }))
        setRowProgress((p) => ({ ...p, [row.key]: null }))
        const controller = new AbortController()
        abortControllerRef.current = controller
        try {
          await pullModel(
            row.tag,
            (p) => {
              if (!cancelled) setRowProgress((prev) => ({ ...prev, [row.key]: p }))
            },
            controller.signal,
          )
          if (cancelled) return
          setRowStatus((s) => ({ ...s, [row.key]: 'ready' }))
        } catch (e) {
          if (cancelled) return
          if (e instanceof DOMException && e.name === 'AbortError') return
          setRowStatus((s) => ({ ...s, [row.key]: 'error' }))
          setDownloadError(e instanceof Error ? e.message : String(e))
          return
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // downloadRows is memoized and only changes via explicit user actions on earlier
    // steps, so this effect only actually restarts when `step` changes to 4.
  }, [step, downloadRows])

  const cancelDownload = () => {
    abortControllerRef.current?.abort()
    setStep(3)
  }

  const finishSetup = () => {
    updateSettings({ setupDone: true, ocrQuant: effectiveQuant, ocrTag: effectiveModel.tag })
    navigate(startStep === 3 ? '/settings' : '/references')
  }

  const allRowsReady = downloadRows.every((r) => {
    const s = rowStatus[r.key]
    return s === 'have' || s === 'ready'
  })
  const anyRowPulling = downloadRows.some((r) => rowStatus[r.key] === 'pulling')
  const anyRowError = downloadRows.some((r) => rowStatus[r.key] === 'error')

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-[720px]">
        <Stepper step={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 26 }}
          >
            {step === 0 && (
              <div>
                <StepTiger state={welcomeState} size={140} className="mb-4 -rotate-3" />
                <Heading className="mb-5">Meet papertiger</Heading>
                <ul className="space-y-2.5 mb-8">
                  {[
                    'Reads your sources on-device.',
                    'Writes in your voice.',
                    'Nothing leaves this Mac.',
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2.5 text-[15px] text-fg-muted">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose border-2 border-[var(--line)] shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
                <GlassButton variant="primary" size="lg" onClick={() => setStep(1)}>
                  Get started
                </GlassButton>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="flex items-end gap-4 mb-2">
                  <StepTiger state={ollama && !ollama.online ? 'sad' : 'wonder'} size={96} className="rotate-3" />
                  <Heading>Your Mac</Heading>
                </div>
                <p className="text-sm text-fg-muted mb-6">
                  We use this to recommend an OCR model that fits your hardware.
                </p>

                <GlassCard className="p-6 mb-6 -rotate-[0.4deg]">
                  {!hw ? (
                    <p className="font-mono text-sm text-fg-faint">Reading your Mac…</p>
                  ) : (
                    <dl className="grid grid-cols-[120px_1fr] gap-y-3.5 items-center">
                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Chip</dt>
                      <dd className="font-mono text-sm text-fg">
                        {hw.source === 'browser' ? 'Browser preview' : hw.chip}
                      </dd>

                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Memory</dt>
                      <dd className="font-mono text-sm text-fg">{hw.ramGb > 0 ? `${fmtGb(hw.ramGb)} GB` : '—'}</dd>

                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">macOS</dt>
                      <dd className="font-mono text-sm text-fg">{hw.source === 'tauri' && hw.macosVersion ? hw.macosVersion : '—'}</dd>

                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Cores</dt>
                      <dd className="font-mono text-sm text-fg">{hw.cpuCores || '—'}</dd>

                      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Ollama</dt>
                      <dd>
                        {ollamaChecking && !ollama ? (
                          <span className="font-mono text-sm text-fg-faint">Checking…</span>
                        ) : ollama?.online ? (
                          <Chip tone="mint" mono>
                            Running · v{ollama.version ?? '?'}
                          </Chip>
                        ) : (
                          <StatusChip status="error">Not found</StatusChip>
                        )}
                      </dd>
                    </dl>
                  )}
                </GlassCard>

                {ollama && !ollama.online && (
                  <div className="mb-6 space-y-3">
                    <p className="text-sm text-fg-muted">
                      papertiger uses Ollama to run the OCR model on-device. Install it, make sure it's
                      running, then check again.
                    </p>
                    <div className="flex items-center gap-2">
                      <GlassButton
                        variant="secondary"
                        size="sm"
                        icon={<ExternalLink size={14} />}
                        onClick={() => window.open('https://ollama.com/download', '_blank')}
                      >
                        Open ollama.com/download
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        icon={<RefreshCw size={14} className={ollamaChecking ? 'animate-spin' : undefined} />}
                        onClick={checkOllamaAgain}
                        disabled={ollamaChecking}
                      >
                        Check again
                      </GlassButton>
                    </div>
                  </div>
                )}

                <GlassButton variant="primary" size="lg" onClick={() => setStep(2)} disabled={!ollama?.online}>
                  Continue
                </GlassButton>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="flex items-end gap-4 mb-2">
                  <StepTiger state="thinking" size={96} className="-rotate-3" />
                  <Heading>Choose an OCR model</Heading>
                </div>
                <p className="text-sm text-fg-muted mb-6">
                  Both read text the same way. The difference is memory and speed.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {Object.values(OCR_MODELS).map((model) => {
                    const isSelected = model.quant === effectiveQuant
                    const isRecommended = recommendation?.quant === model.quant
                    return (
                      <button
                        key={model.quant}
                        type="button"
                        onClick={() => selectQuant(model.quant)}
                        className={clsx(
                          'relative text-left p-5 transition-colors sketch-btn',
                          isRecommended ? 'sketch-alt' : 'sketch',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                          isSelected ? 'bg-rose/40' : 'hover:bg-[var(--panel-2)]',
                        )}
                      >
                        {isRecommended && (
                          <span className="absolute -top-3 right-3 rotate-3 bg-rose border-2 border-[var(--line)] px-2.5 py-0.5 font-display text-[16px] leading-none text-fg wobble">
                            recommended
                          </span>
                        )}
                        {isSelected && (
                          <motion.div
                            layoutId="wizard-pill"
                            className="absolute inset-1 wobble-alt border-2 border-dashed border-[var(--line)] pointer-events-none"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                        <p className="font-display text-[22px] leading-tight text-fg mb-2">{model.label}</p>
                        <p className="text-sm text-fg-muted mb-3">{model.blurb}</p>
                        <p className="font-mono text-[11px] text-fg-faint uppercase tracking-[0.08em]">
                          {fmtGb(model.downloadGb)} GB download · {fmtGb(model.residentGb)} GB memory
                        </p>
                      </button>
                    )
                  })}
                </div>

                {recommendation && <p className="text-sm text-fg-muted mb-8">{recommendation.reason}</p>}

                <GlassButton variant="primary" size="lg" onClick={confirmModel}>
                  Use this model
                </GlassButton>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex flex-wrap items-end gap-4 mb-2">
                  <StepTiger state="listening" size={96} className="rotate-3" />
                  <Heading>Choose a writer</Heading>
                  <Chip tone="tiger" mono>
                    Optional
                  </Chip>
                </div>
                <p className="text-sm text-fg-muted mb-6">
                  Optional. You can add or change it later in Settings.
                </p>

                {!hw ? (
                  <p className="font-mono text-sm text-fg-faint mb-6">Reading your Mac…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                      {WRITER_FAMILY_ORDER.map((family) => {
                        const info = WRITER_FAMILIES[family]
                        const variants = WRITER_MODELS.filter((m) => m.family === family)
                        return (
                          <GlassCard key={family} className="p-5">
                            <p className="font-display text-[22px] leading-tight text-fg mb-1">{info.name}</p>
                            <p className="text-sm text-fg-muted mb-4">{info.blurb}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {variants.map((model) => {
                                const fit = writerFit(model, hw)
                                const isSelected = effectiveWriterVariantId === model.id
                                const isRecommended = writerRecommendation?.id === model.id
                                const disabled = fit.fit === 'no'
                                return (
                                  <button
                                    key={model.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setSelectedWriterVariantId(model.id)}
                                    title={fit.note || undefined}
                                    className={clsx(
                                      'relative text-left px-3 py-2.5 border-2 transition-colors wobble',
                                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                                      disabled && 'opacity-40 pointer-events-none',
                                      isSelected
                                        ? 'bg-tiger border-[var(--line)] text-on-tiger'
                                        : 'border-[var(--line-soft)] bg-panel hover:bg-rose/30 text-fg',
                                    )}
                                  >
                                    {isRecommended && (
                                      <span
                                        aria-hidden="true"
                                        className={clsx(
                                          'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                                          isSelected ? 'bg-rose' : 'bg-tiger',
                                        )}
                                      />
                                    )}
                                    <p className={clsx('font-display text-[17px] leading-tight', isSelected ? 'text-on-tiger' : 'text-fg')}>
                                      {model.params} · {model.quant.toUpperCase()}
                                    </p>
                                    <p
                                      className={clsx(
                                        'font-mono text-[11px] mt-0.5',
                                        isSelected ? 'text-on-tiger/70' : 'text-fg-faint',
                                      )}
                                    >
                                      {fmtGb(model.downloadGb)} GB
                                    </p>
                                    {fit.note && (
                                      <p
                                        className={clsx(
                                          'font-mono text-[10px] mt-1 leading-snug',
                                          fit.fit === 'no' ? 'text-danger' : fit.fit === 'tight' ? 'text-ember' : 'text-mint',
                                        )}
                                      >
                                        {fit.note}
                                      </p>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </GlassCard>
                        )
                      })}
                    </div>

                    {writerRecommendation && <p className="text-sm text-fg-muted mb-8">{writerRecommendation.reason}</p>}

                    <div className="flex items-center gap-2">
                      <GlassButton
                        variant="primary"
                        size="lg"
                        onClick={useThisWriter}
                        disabled={!effectiveWriterVariantId}
                      >
                        Use this writer
                      </GlassButton>
                      <GlassButton variant="ghost" size="lg" onClick={skipWriter}>
                        Skip for now
                      </GlassButton>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex items-end gap-4 mb-2">
                  <StepTiger state={anyRowError ? 'confused' : 'busy'} size={96} className="-rotate-3" />
                  <Heading>Setting up your models</Heading>
                </div>
                <p className="text-sm text-fg-muted mb-6">
                  {downloadRows.length > 1
                    ? `${effectiveModel.label}, then ${writerModel?.label ?? 'your writer'}.`
                    : effectiveModel.label}
                </p>

                <div className="space-y-4 mb-6">
                  {downloadRows.map((row) => {
                    const status: RowStatus = rowStatus[row.key] ?? 'pending'
                    const progress = rowProgress[row.key] ?? null
                    const completedGb = progress?.completed != null ? progress.completed / 1e9 : 0
                    const totalGb = progress?.total != null ? progress.total / 1e9 : row.downloadGb
                    const percent = Math.min(100, Math.max(0, progress?.percent ?? 0))

                    return (
                      <GlassCard key={row.key} className="p-6">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <p className="font-display text-[22px] leading-tight text-fg">{row.label}</p>
                          {status === 'have' && (
                            <Chip tone="mint" mono>
                              Already on this Mac
                            </Chip>
                          )}
                          {status === 'ready' && (
                            <Chip tone="mint" mono>
                              Ready
                            </Chip>
                          )}
                        </div>

                        {(status === 'pending' || status === 'checking') && (
                          <p className="font-mono text-sm text-fg-faint">Checking what's already on this Mac…</p>
                        )}

                        {status === 'pulling' && (
                          <div>
                            <div className="h-4 wobble border-2 border-[var(--line)] bg-panel-2 overflow-hidden mb-3">
                              <motion.div
                                className="hatch hatch-animate h-full border-r-2 border-[var(--line)] bg-tiger"
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.2 }}
                              />
                            </div>
                            <p className="font-mono text-sm text-fg mb-1">
                              {fmtGb(completedGb)} GB of {fmtGb(totalGb)} GB · {Math.round(percent)}%
                            </p>
                            <p className="font-mono text-[11px] text-fg-faint uppercase tracking-[0.08em]">
                              {progress?.status || 'starting…'}
                            </p>
                          </div>
                        )}

                        {status === 'error' && (
                          <div>
                            <p className="font-display text-[18px] text-danger mb-1">Something went wrong.</p>
                            <p className="font-mono text-[11px] text-fg-faint">{downloadError}</p>
                          </div>
                        )}
                      </GlassCard>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {anyRowPulling && (
                    <GlassButton variant="ghost" size="lg" icon={<X size={16} />} onClick={cancelDownload}>
                      Cancel
                    </GlassButton>
                  )}
                  {allRowsReady && (
                    <GlassButton
                      variant="primary"
                      size="lg"
                      icon={<CheckCircle2 size={16} />}
                      onClick={() => setStep(5)}
                    >
                      Continue
                    </GlassButton>
                  )}
                  {anyRowError && (
                    <GlassButton variant="secondary" size="lg" onClick={() => setStep(3)}>
                      Back
                    </GlassButton>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <StepTiger state="excited" size={140} className="mb-2 rotate-3" />
                <Heading className="mb-4">You're set</Heading>
                <ul className="space-y-2 mb-8">
                  <li className="text-sm text-fg-muted">
                    {effectiveModel.label} is ready · {fmtGb(effectiveModel.residentGb)} GB in memory when in use.
                  </li>
                  <li className="text-sm text-fg-muted">
                    {writerModel
                      ? `${writerModel.label} is ready · ${fmtGb(writerModel.residentGb)} GB in memory when in use.`
                      : 'Writer: skipped — add one in Settings.'}
                  </li>
                </ul>
                <GlassButton variant="primary" size="lg" icon={<Cpu size={16} />} onClick={finishSetup}>
                  {startStep === 3 ? 'Back to Settings' : 'Open Sources'}
                </GlassButton>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
