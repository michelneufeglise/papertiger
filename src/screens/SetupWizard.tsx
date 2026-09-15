import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { CheckCircle2, ExternalLink, RefreshCw, Cpu, X } from 'lucide-react'

import { GlassCard, GlassButton, Chip, Stripe } from '../components/ui'
import { getHardwareInfo, recommendQuant, type HardwareInfo, type Quant } from '../lib/hardware'
import { OCR_MODELS } from '../lib/models'
import { getStatus, hasModel, pullModel, type OllamaStatus, type PullProgress } from '../lib/ollama'
import { readSettings, updateSettings } from '../lib/settings'

type StepIndex = 0 | 1 | 2 | 3 | 4

const STEP_LABELS = ['Welcome', 'Your Mac', 'Model', 'Download', 'Done']

const fmtGb = (n: number) => n.toFixed(1)

type DownloadState = 'checking' | 'has-model' | 'pulling' | 'success' | 'error'

const stepVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
}

const Stepper: React.FC<{ step: StepIndex }> = ({ step }) => (
  <div className="flex items-center justify-between mb-10">
    {STEP_LABELS.map((label, i) => {
      const isCurrent = i === step
      const isDone = i < step
      return (
        <div key={label} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em]">
          {isCurrent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-tiger" aria-hidden="true" />}
          <span className={clsx(isCurrent ? 'text-tiger' : isDone ? 'text-fg-muted' : 'text-fg-faint')}>
            {label}
          </span>
        </div>
      )
    })}
  </div>
)

export const SetupWizard: React.FC = () => {
  const navigate = useNavigate()

  const [step, setStep] = React.useState<StepIndex>(0)

  const [hw, setHw] = React.useState<HardwareInfo | null>(null)
  const [ollama, setOllama] = React.useState<OllamaStatus | null>(null)
  const [ollamaChecking, setOllamaChecking] = React.useState(true)

  const [selectedQuant, setSelectedQuant] = React.useState<Quant | null>(() => readSettings().ocrQuant)

  const [downloadState, setDownloadState] = React.useState<DownloadState>('checking')
  const [progress, setProgress] = React.useState<PullProgress | null>(null)
  const [pullError, setPullError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const recommendation = hw ? recommendQuant(hw) : null
  const effectiveQuant: Quant = selectedQuant ?? recommendation?.quant ?? 'q4'
  const effectiveModel = OCR_MODELS[effectiveQuant]

  // Fetch hardware + Ollama status once, as soon as the wizard mounts.
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
    setDownloadState('checking')
    setProgress(null)
    setPullError(null)
    setStep(3)
  }

  // Download step: check for the model, then pull it if missing.
  React.useEffect(() => {
    if (step !== 3) return
    let cancelled = false

    async function run() {
      try {
        const already = await hasModel(effectiveModel.tag)
        if (cancelled) return
        if (already) {
          setDownloadState('has-model')
          return
        }
      } catch {
        // fall through and try to pull anyway
      }
      if (cancelled) return

      setDownloadState('pulling')
      const controller = new AbortController()
      abortControllerRef.current = controller
      try {
        await pullModel(
          effectiveModel.tag,
          (p) => {
            if (!cancelled) setProgress(p)
          },
          controller.signal,
        )
        if (!cancelled) setDownloadState('success')
      } catch (e) {
        if (cancelled) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setDownloadState('error')
        setPullError(e instanceof Error ? e.message : String(e))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [step, effectiveModel.tag])

  const cancelDownload = () => {
    abortControllerRef.current?.abort()
    setStep(2)
  }

  const finishSetup = () => {
    updateSettings({ setupDone: true, ocrQuant: effectiveQuant, ocrTag: effectiveModel.tag })
    navigate('/references')
  }

  const completedGb = progress?.completed != null ? progress.completed / 1e9 : 0
  const totalGb = progress?.total != null ? progress.total / 1e9 : effectiveModel.downloadGb
  const percent = Math.min(100, Math.max(0, progress?.percent ?? 0))

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
            transition={{ duration: 0.18 }}
          >
            {step === 0 && (
              <div>
                <h1 className="font-display text-3xl font-bold text-fg mb-4">Meet papertiger</h1>
                <ul className="space-y-2.5 mb-8">
                  {[
                    'Reads your sources on-device.',
                    'Writes in your voice.',
                    'Nothing leaves this Mac.',
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2.5 text-sm text-fg-muted">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-tiger shrink-0" />
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
                <h1 className="font-display text-3xl font-bold text-fg mb-2">Your Mac</h1>
                <p className="text-sm text-fg-muted mb-6">
                  We use this to recommend an OCR model that fits your hardware.
                </p>

                <GlassCard className="p-6 mb-6">
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
                          <Chip tone="rose" mono>
                            Not found
                          </Chip>
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
                <h1 className="font-display text-3xl font-bold text-fg mb-2">Choose an OCR model</h1>
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
                          'relative text-left p-5 rounded-[var(--r-lg)] border transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger',
                          isSelected ? 'border-tiger/60 bg-[var(--panel-2)]' : 'border-line bg-panel hover:bg-[var(--panel-2)]',
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="wizard-pill"
                            className="absolute inset-0 rounded-[var(--r-lg)] border-2 border-tiger pointer-events-none"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-display font-bold text-fg text-base">{model.label}</p>
                          {isRecommended && (
                            <Chip tone="tiger" mono>
                              Recommended
                            </Chip>
                          )}
                        </div>
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
                <h1 className="font-display text-3xl font-bold text-fg mb-2">Setting up the model</h1>
                <p className="text-sm text-fg-muted mb-6">{effectiveModel.label}</p>

                <GlassCard className="p-6 mb-6">
                  {downloadState === 'checking' && (
                    <p className="font-mono text-sm text-fg-faint">Checking what's already on this Mac…</p>
                  )}

                  {downloadState === 'has-model' && (
                    <div className="flex items-center gap-2">
                      <Chip tone="mint" mono>
                        Already on this Mac
                      </Chip>
                    </div>
                  )}

                  {downloadState === 'pulling' && (
                    <div>
                      <Stripe active className="mb-3" />
                      <div className="h-2 rounded-full bg-[var(--panel-2)] overflow-hidden mb-3">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(90deg, var(--tiger), var(--ember))' }}
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

                  {downloadState === 'success' && (
                    <div className="flex items-center gap-2">
                      <Chip tone="mint" mono>
                        Download complete
                      </Chip>
                    </div>
                  )}

                  {downloadState === 'error' && (
                    <div>
                      <p className="text-sm text-rose mb-1">Something went wrong.</p>
                      <p className="font-mono text-[11px] text-fg-faint">{pullError}</p>
                    </div>
                  )}
                </GlassCard>

                <div className="flex items-center gap-2">
                  {downloadState === 'pulling' && (
                    <GlassButton variant="ghost" size="lg" icon={<X size={16} />} onClick={cancelDownload}>
                      Cancel
                    </GlassButton>
                  )}
                  {(downloadState === 'has-model' || downloadState === 'success') && (
                    <GlassButton
                      variant="primary"
                      size="lg"
                      icon={<CheckCircle2 size={16} />}
                      onClick={() => setStep(4)}
                    >
                      Continue
                    </GlassButton>
                  )}
                  {downloadState === 'error' && (
                    <GlassButton variant="secondary" size="lg" onClick={() => setStep(2)}>
                      Back
                    </GlassButton>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h1 className="font-display text-3xl font-bold text-fg mb-2">You're set</h1>
                <p className="text-sm text-fg-muted mb-8">
                  {effectiveModel.label} is ready · {fmtGb(effectiveModel.residentGb)} GB in memory when in use.
                </p>
                <GlassButton variant="primary" size="lg" icon={<Cpu size={16} />} onClick={finishSetup}>
                  Open Sources
                </GlassButton>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
