/**
 * WizardContext: shared state and navigation for the setup wizard steps.
 *
 * Steps call `useWizard()` and may use:
 *
 * Navigation
 *   step, stepIndex     current StepId and its 0-based index in STEPS
 *   next() / back()     move one step forward / back (persisted, guide reset)
 *   goTo(id, {returnToDone?})   jump to any step (e.g. a "Change" link on Done passes
 *                       returnToDone: true)
 *   returnToDone        "return mode": on while a targeted edit is in progress (Done's Change
 *                       buttons, or ?step=<id>&from=settings). next() then goes ocr/writer ->
 *                       download -> done, skipping the rest. Cleared on reaching Done / finish().
 *                       Steps relabel their Continue button "Back to summary" while it is on.
 *   finish(dest?)       mark setup done, clear saved step, navigate to dest
 *                       (default: /settings when opened from Settings, else /references)
 *   fromSettings        true when opened with ?from=settings
 *
 * Guide (the speech bubble + pose above the step)
 *   useGuide(stepId, {tiger?, line?} | null)   hook: override pose/line for this step;
 *                                              reverts automatically when the step changes
 *   setGuide(stepId, {tiger?, line?} | null)   imperative form of the same
 *
 * Footer
 *   <WizardActions>...</WizardActions> (from ./parts) portals buttons into the
 *   footer, bottom-left, always visible. <Heading> (./parts) is auto-focused.
 *
 * Machine / Ollama
 *   hw                  HardwareInfo | null (null while reading)
 *   ollama              OllamaStatus | null; ollamaChecking boolean
 *   checkOllamaAgain({silent?})   re-poll Ollama
 *
 * OCR model
 *   recommendation      recommendQuant(hw) or null
 *   effectiveQuant      chosen quant, else recommended, else 'q4'; effectiveModel is its OCR_MODELS entry
 *   selectQuant(q)      choose + persist; confirmOcr() persists and goes next
 *
 * Writer
 *   writerRecommendation, effectiveWriterVariantId, setSelectedWriterVariantId(id)
 *   writerDecision      {id, tag, skipped} as saved; writerModel is its catalog entry
 *   useThisWriter() / skipWriter()   persist + go next
 *
 * Download
 *   downloadRows, rowStatus, rowProgress, downloadError, allRowsReady,
 *   anyRowPulling, anyRowError, cancelDownload() (aborts and goes back to the writer step)
 *
 * Preferences (pdfTextLayer, voice tunings, theme) are NOT here: use readSettings /
 * updateSettings, useVoice / setTuning, useTheme directly.
 */
import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import type { TigerState } from '../../lib/tiger'
import { getHardwareInfo, recommendQuant, recommendWriter, type HardwareInfo, type Quant } from '../../lib/hardware'
import { OCR_MODELS, writerById, type OcrModel, type WriterModel } from '../../lib/models'
import { getStatus, hasModel, pullModel, type OllamaStatus, type PullProgress } from '../../lib/ollama'
import { readSettings, updateSettings } from '../../lib/settings'
import { STEP_IDS, isStepId, type StepId } from './steps'

export type RowStatus = 'pending' | 'checking' | 'have' | 'pulling' | 'ready' | 'error'

export interface DownloadRow {
  key: 'ocr' | 'writer'
  label: string
  tag: string
  downloadGb: number
}

export interface WriterDecision {
  id: string | null
  tag: string | null
  skipped: boolean
}

export interface GuideOverride {
  tiger?: TigerState
  line?: string
}

const STEP_KEY = 'papertiger.setupStep'

function readSavedStep(): StepId | null {
  try {
    const v = window.localStorage.getItem(STEP_KEY)
    return isStepId(v) ? v : null
  } catch {
    return null
  }
}
function saveStep(id: StepId) {
  try {
    window.localStorage.setItem(STEP_KEY, id)
  } catch {
    /* ignore */
  }
}
function clearSavedStep() {
  try {
    window.localStorage.removeItem(STEP_KEY)
  } catch {
    /* ignore */
  }
}

export interface WizardValue {
  step: StepId
  stepIndex: number
  next: () => void
  back: () => void
  goTo: (id: StepId, opts?: { returnToDone?: boolean }) => void
  finish: (dest?: string) => void
  fromSettings: boolean
  returnToDone: boolean

  guideOverride: GuideOverride | null
  setGuide: (id: StepId, g: GuideOverride | null) => void

  footerEl: HTMLElement | null
  setFooterEl: (el: HTMLElement | null) => void

  hw: HardwareInfo | null
  ollama: OllamaStatus | null
  ollamaChecking: boolean
  checkOllamaAgain: (opts?: { silent?: boolean }) => Promise<void>

  recommendation: ReturnType<typeof recommendQuant> | null
  effectiveQuant: Quant
  effectiveModel: OcrModel
  selectQuant: (q: Quant) => void
  confirmOcr: () => void

  writerRecommendation: ReturnType<typeof recommendWriter> | null
  effectiveWriterVariantId: string | null
  setSelectedWriterVariantId: (id: string | null) => void
  writerDecision: WriterDecision
  writerModel: WriterModel | undefined
  useThisWriter: () => void
  skipWriter: () => void

  downloadRows: DownloadRow[]
  rowStatus: Record<string, RowStatus>
  rowProgress: Record<string, PullProgress | null>
  downloadError: string | null
  allRowsReady: boolean
  anyRowPulling: boolean
  anyRowError: boolean
  cancelDownload: () => void
}

const WizardCtx = React.createContext<WizardValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useWizard(): WizardValue {
  const v = React.useContext(WizardCtx)
  if (!v) throw new Error('useWizard must be used inside <WizardProvider>')
  return v
}

/** Override the guide pose/line while this step is mounted. Pass null for no override. */
// eslint-disable-next-line react-refresh/only-export-components
export function useGuide(id: StepId, g: GuideOverride | null): void {
  const { setGuide } = useWizard()
  const tiger = g?.tiger
  const line = g?.line
  const active = g !== null
  React.useEffect(() => {
    setGuide(id, active ? { tiger, line } : null)
  }, [setGuide, id, active, tiger, line])
}

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromSettings = searchParams.get('from') === 'settings'

  const [step, setStep] = React.useState<StepId>(() => {
    const param = searchParams.get('step')
    if (isStepId(param)) return param
    if (fromSettings) return 'welcome'
    return readSavedStep() ?? 'welcome'
  })
  const stepIndex = STEP_IDS.indexOf(step)

  const [guides, setGuides] = React.useState<Partial<Record<StepId, GuideOverride>>>({})
  const [footerEl, setFooterEl] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    saveStep(step)
  }, [step])

  const [returnToDone, setReturnToDone] = React.useState<boolean>(
    () => fromSettings && isStepId(searchParams.get('step')) && searchParams.get('step') !== 'done',
  )
  const returnRef = React.useRef(returnToDone)
  const setReturn = React.useCallback((on: boolean) => {
    returnRef.current = on
    setReturnToDone(on)
  }, [])

  const stepRef = React.useRef(step)
  React.useEffect(() => {
    stepRef.current = step
  }, [step])

  const goTo = React.useCallback(
    (id: StepId, opts?: { returnToDone?: boolean }) => {
      if (opts?.returnToDone !== undefined) setReturn(opts.returnToDone)
      setGuides({})
      setStep(id)
    },
    [setReturn],
  )
  const next = React.useCallback(() => {
    setGuides({})
    const s = stepRef.current
    let target: StepId
    if (returnRef.current) {
      target = s === 'ocr' || s === 'writer' ? 'download' : 'done'
      if (target === 'done') setReturn(false) // reaching Done ends return mode
    } else {
      target = STEP_IDS[Math.min(STEP_IDS.length - 1, STEP_IDS.indexOf(s) + 1)]
    }
    stepRef.current = target
    setStep(target)
  }, [setReturn])
  const back = React.useCallback(() => {
    setGuides({})
    setStep((s) => STEP_IDS[Math.max(0, STEP_IDS.indexOf(s) - 1)])
  }, [])
  const setGuide = React.useCallback((id: StepId, g: GuideOverride | null) => {
    setGuides((prev) => {
      if (g === null) {
        if (!(id in prev)) return prev
        const rest = { ...prev }
        delete rest[id]
        return rest
      }
      const cur = prev[id]
      if (cur && cur.tiger === g.tiger && cur.line === g.line) return prev
      return { ...prev, [id]: g }
    })
  }, [])

  const [hw, setHw] = React.useState<HardwareInfo | null>(null)
  const [ollama, setOllama] = React.useState<OllamaStatus | null>(null)
  const [ollamaChecking, setOllamaChecking] = React.useState(true)

  const [selectedQuant, setSelectedQuant] = React.useState<Quant | null>(() => readSettings().ocrQuant)
  const [selectedWriterVariantId, setSelectedWriterVariantId] = React.useState<string | null>(() => readSettings().writerId)
  const [writerDecision, setWriterDecision] = React.useState<WriterDecision>(() => {
    const s = readSettings()
    return { id: s.writerId, tag: s.writerTag, skipped: s.writerSkipped }
  })

  const [rowStatus, setRowStatus] = React.useState<Record<string, RowStatus>>({})
  const [rowProgress, setRowProgress] = React.useState<Record<string, PullProgress | null>>({})
  const [downloadError, setDownloadError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const recommendation = hw ? recommendQuant(hw) : null
  const effectiveQuant: Quant = selectedQuant ?? recommendation?.quant ?? 'q4'
  const effectiveModel = OCR_MODELS[effectiveQuant]

  const writerRecommendation = hw ? recommendWriter(hw) : null
  const effectiveWriterVariantId = selectedWriterVariantId ?? writerRecommendation?.id ?? null
  const writerModel = writerDecision.id ? writerById(writerDecision.id) : undefined

  // Hardware + Ollama status once, as soon as the wizard mounts (steps can be entered directly).
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

  const checkOllamaAgain = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setOllamaChecking(true)
    try {
      const status = await getStatus()
      setOllama(status)
    } finally {
      if (!opts?.silent) setOllamaChecking(false)
    }
  }, [])

  const selectQuant = (quant: Quant) => {
    setSelectedQuant(quant)
    updateSettings({ ocrQuant: quant, ocrTag: OCR_MODELS[quant].tag })
  }

  const confirmOcr = () => {
    updateSettings({ ocrQuant: effectiveQuant, ocrTag: effectiveModel.tag })
    next()
  }

  const useThisWriter = () => {
    if (!effectiveWriterVariantId) return
    const model = writerById(effectiveWriterVariantId)
    if (!model) return
    updateSettings({ writerId: model.id, writerTag: model.tag, writerSkipped: false })
    setWriterDecision({ id: model.id, tag: model.tag, skipped: false })
    next()
  }

  const skipWriter = () => {
    updateSettings({ writerId: null, writerTag: null, writerSkipped: true })
    setWriterDecision({ id: null, tag: null, skipped: true })
    next()
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
  const downloading = step === 'download'
  React.useEffect(() => {
    if (!downloading) return
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
    // downloadRows is memoized and only changes through explicit choices on earlier steps.
  }, [downloading, downloadRows])

  const cancelDownload = () => {
    abortControllerRef.current?.abort()
    goTo('writer')
  }

  const finish = (dest?: string) => {
    updateSettings({ setupDone: true, ocrQuant: effectiveQuant, ocrTag: effectiveModel.tag })
    clearSavedStep()
    setReturn(false)
    navigate(dest ?? (fromSettings ? '/settings' : '/references'))
  }

  const allRowsReady = downloadRows.every((r) => {
    const s = rowStatus[r.key]
    return s === 'have' || s === 'ready'
  })
  const anyRowPulling = downloadRows.some((r) => rowStatus[r.key] === 'pulling')
  const anyRowError = downloadRows.some((r) => rowStatus[r.key] === 'error')

  const value: WizardValue = {
    step,
    stepIndex,
    next,
    back,
    goTo,
    finish,
    fromSettings,
    returnToDone,
    guideOverride: guides[step] ?? null,
    setGuide,
    footerEl,
    setFooterEl,
    hw,
    ollama,
    ollamaChecking,
    checkOllamaAgain,
    recommendation,
    effectiveQuant,
    effectiveModel,
    selectQuant,
    confirmOcr,
    writerRecommendation,
    effectiveWriterVariantId,
    setSelectedWriterVariantId,
    writerDecision,
    writerModel,
    useThisWriter,
    skipWriter,
    downloadRows,
    rowStatus,
    rowProgress,
    downloadError,
    allRowsReady,
    anyRowPulling,
    anyRowError,
    cancelDownload,
  }

  return <WizardCtx.Provider value={value}>{children}</WizardCtx.Provider>
}

