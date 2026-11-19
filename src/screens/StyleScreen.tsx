import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard, GlassButton, Chip, Stripe, Tiger } from '../components/ui'
import {
  mockStyleMetrics,
  mockStyleExamples,
  mockStyleTunings,
  mockPreviewText,
} from '../mock/styleMetrics'
import type { StyleMetric } from '../mock/styleMetrics'
import { useVoice, setTuning, type VoiceTunings } from '../lib/voice'

/** mockStyleTunings only supplies name/description/min/max now — the live value comes from the voice store. */
const TUNING_KEY_BY_NAME: Record<string, keyof VoiceTunings> = {
  Formality: 'formality',
  Conciseness: 'conciseness',
  Technicality: 'technicality',
}

/** Each metric has a different scale, so the mini bar needs a per-unit read on "how full". */
const metricFill = (metric: StyleMetric): number => {
  switch (metric.unit) {
    case '/10':
      return Math.min(100, (metric.value / 10) * 100)
    case '%':
      return Math.min(100, (metric.value / 100) * 100)
    case 'words':
      return Math.min(100, (metric.value / 30) * 100)
    case 'grade':
      return Math.min(100, (metric.value / 20) * 100)
    default:
      return Math.min(100, metric.value)
  }
}

export const StyleScreen: React.FC = () => {
  const voice = useVoice()
  const [isRetraining, setIsRetraining] = useState(false)
  const [justDone, setJustDone] = useState(false)

  const handleTuningChange = (name: string, value: number) => {
    const key = TUNING_KEY_BY_NAME[name]
    if (!key) return
    setTuning(key, value)
  }

  const handleRetrain = () => {
    setIsRetraining(true)
    setJustDone(false)
    setTimeout(() => {
      setIsRetraining(false)
      setJustDone(true)
    }, 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h1 className="font-display text-[34px] leading-tight text-fg mb-3">
            <span className="doodle-underline">Your voice</span>
          </h1>
          <p className="text-sm text-fg-muted mt-4">
            How you write, learned from your edits. Grammar is always corrected.
          </p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockStyleMetrics.map((metric, idx) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: idx * 0.05 }}
            >
              <GlassCard className={`p-4 h-full ${idx % 2 ? 'sketch-alt rotate-[0.8deg]' : '-rotate-[0.8deg]'}`}>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="font-display text-[44px] leading-none text-fg">
                    {metric.value}
                  </span>
                  <span className="font-mono text-[11px] text-fg-muted">{metric.unit}</span>
                </div>
                <h3 className="font-display text-[19px] text-fg mb-1">{metric.name}</h3>
                <p className="text-xs text-fg-muted leading-relaxed mb-3">
                  {metric.description}
                </p>
                <div className="h-2.5 bg-panel-2 wobble border-2 border-[var(--line)] overflow-hidden">
                  <motion.div
                    className="h-full bg-rose border-r-2 border-[var(--line)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${metricFill(metric)}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.03 + 0.1 }}
                  />
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Before / after */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockStyleExamples.map((example, idx) => {
            const tuned = idx === 1
            return (
              <motion.div
                key={example.label}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: idx * 0.06 }}
              >
                <GlassCard className={`p-5 h-full ${tuned ? 'sketch-alt rotate-1' : '-rotate-1'}`}>
                  <div className="mb-3">
                    {tuned ? (
                      <Chip tone="mint">Tuned</Chip>
                    ) : (
                      <Chip tone="neutral">Your draft</Chip>
                    )}
                  </div>
                  <p className="text-[15px] text-fg leading-[1.7]">{example.text}</p>
                  {tuned && (
                    <p className="mt-3 font-mono text-[11px] text-fg-faint tracking-[0.02em]">
                      + grammar&nbsp;&nbsp;= voice
                    </p>
                  )}
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* Tuning */}
        <GlassCard className="p-6 space-y-6" variant="raised">
          {mockStyleTunings.map((tuning, idx) => {
            const key = TUNING_KEY_BY_NAME[tuning.name]
            const value = key ? voice[key] : tuning.value
            const pct = ((value - tuning.min) / (tuning.max - tuning.min)) * 100
            return (
              <motion.div
                key={tuning.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="font-display text-[19px] text-fg">{tuning.name}</label>
                  <Chip tone="tiger" mono>
                    {value} / {tuning.max}
                  </Chip>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-fg-faint">{tuning.min}</span>
                  <input
                    type="range"
                    min={tuning.min}
                    max={tuning.max}
                    value={value}
                    onChange={e =>
                      handleTuningChange(tuning.name, parseInt(e.target.value, 10))
                    }
                    style={{ ['--range-fill' as string]: `${pct}%` }}
                    className="flex-1"
                  />
                  <span className="font-mono text-[11px] text-fg-faint">{tuning.max}</span>
                </div>

                <p className="text-xs text-fg-muted mt-2">{tuning.description}</p>
              </motion.div>
            )
          })}

          {/* Live preview */}
          <div className="border-t-2 border-dashed border-[var(--line-soft)] pt-6">
            <p className="font-display text-[19px] text-fg mb-3">
              Live preview
            </p>
            <div className="p-4 bg-panel-2 wobble-alt border-2 border-dashed border-[var(--line-soft)] text-sm text-fg leading-relaxed">
              {mockPreviewText}
            </div>
          </div>
        </GlassCard>

        {/* Retrain */}
        <GlassCard className="sketch-alt p-6 flex items-center gap-5">
          <Tiger
            state={isRetraining ? 'thinking' : justDone ? 'proud' : 'listening'}
            size={88}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[22px] text-fg mb-1">Learn from my edits</h3>
            <p className="text-sm text-fg-muted mb-4 leading-relaxed">
              The tiger learns from every manual edit you make. Run this to fold your latest
              changes into your voice.
            </p>

            {isRetraining && (
              <motion.div
                className="mb-4 space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Stripe active className="h-1.5" />
                <p className="font-mono text-[11px] text-fg-muted">learning…</p>
              </motion.div>
            )}

            <GlassButton onClick={handleRetrain} disabled={isRetraining} variant="primary" size="sm">
              Learn from my edits
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
