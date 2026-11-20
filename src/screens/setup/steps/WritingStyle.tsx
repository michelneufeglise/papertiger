import React from 'react'
import { RotateCcw } from 'lucide-react'
import { Chip, GlassButton, GlassCard } from '../../../components/ui'
import { DEFAULT_TUNINGS, describeVoice, setTuning, useVoice, type VoiceTunings } from '../../../lib/voice'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const SLIDERS: { key: keyof VoiceTunings; label: string }[] = [
  { key: 'formality', label: 'Formality' },
  { key: 'conciseness', label: 'Conciseness' },
  { key: 'technicality', label: 'Technicality' },
]

export const WritingStyle: React.FC = () => {
  const { next, returnToDone } = useWizard()
  const voice = useVoice()
  const [scribbling, setScribbling] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)

  useGuide('style', scribbling ? { tiger: 'scribbling-fast' } : null)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const change = (key: keyof VoiceTunings, value: number) => {
    setTuning(key, value)
    setScribbling(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setScribbling(false), 1200)
  }

  const reset = () => {
    for (const s of SLIDERS) setTuning(s.key, DEFAULT_TUNINGS[s.key])
  }

  return (
    <div>
      <Heading className="mb-2">Your writing style</Heading>
      <p className="text-sm text-fg-muted mb-4">The writer follows these when drafting. You can adjust them any time in Settings.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <GlassCard className="p-5 space-y-4">
          {SLIDERS.map(({ key, label }) => {
            const value = voice[key]
            const pct = ((value - 1) / 9) * 100
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor={`voice-${key}`} className="font-display text-[19px] text-fg">
                    {label}
                  </label>
                  <Chip tone="tiger" mono>
                    {value} / 10
                  </Chip>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-fg-faint">1</span>
                  <input
                    id={`voice-${key}`}
                    type="range"
                    min={1}
                    max={10}
                    value={value}
                    onChange={(e) => change(key, parseInt(e.target.value, 10))}
                    style={{ ['--range-fill' as string]: `${pct}%` }}
                    className="flex-1"
                  />
                  <span className="font-mono text-[11px] text-fg-faint">10</span>
                </div>
              </div>
            )
          })}
        </GlassCard>

        <GlassCard className="p-5">
          <p className="font-mono text-[11px] text-fg-faint uppercase tracking-[0.08em] mb-3">Preview: the writer is told</p>
          <ul className="space-y-2" aria-live="polite">
            {describeVoice(voice).map((line) => (
              <li key={line} className="text-sm text-fg-muted flex gap-2">
                <span aria-hidden="true" className="text-fg">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next}>
          {returnToDone ? 'Back to summary' : 'Continue'}
        </GlassButton>
        <GlassButton variant="ghost" size="lg" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" /> Reset to defaults
        </GlassButton>
      </WizardActions>
    </div>
  )
}
