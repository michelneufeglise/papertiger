import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard, GlassButton, Chip, Stripe } from '../components/ui'
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

  const handleTuningChange = (name: string, value: number) => {
    const key = TUNING_KEY_BY_NAME[name]
    if (!key) return
    setTuning(key, value)
  }

  const handleRetrain = () => {
    setIsRetraining(true)
    setTimeout(() => {
      setIsRetraining(false)
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
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-fg mb-1.5">
            Your voice
          </h1>
          <p className="text-sm text-fg-muted">
            How you write, learned from your edits. Grammar is always corrected.
          </p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockStyleMetrics.map((metric, idx) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <GlassCard className="p-4 h-full">
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="font-display text-[32px] font-bold leading-none tracking-[-0.02em] text-fg">
                    {metric.value}
                  </span>
                  <span className="font-mono text-[11px] text-fg-muted">{metric.unit}</span>
                </div>
                <h3 className="text-[13px] font-semibold text-fg mb-1">{metric.name}</h3>
                <p className="text-xs text-fg-muted leading-relaxed mb-3">
                  {metric.description}
                </p>
                <div className="h-1 bg-panel-2 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-tiger to-ember"
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
              >
                <GlassCard className="p-5 h-full">
                  <div className="mb-3">
                    {tuned ? (
                      <Chip tone="mint">Tuned</Chip>
                    ) : (
                      <Chip tone="neutral">Your draft</Chip>
                    )}
                  </div>
                  <p className="text-sm text-fg leading-relaxed">{example.text}</p>
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
                  <label className="text-sm font-semibold text-fg">{tuning.name}</label>
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
          <div className="border-t border-line pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-3">
              Live preview
            </p>
            <div className="p-4 bg-panel-2 rounded-[var(--r-md)] text-sm text-fg leading-relaxed">
              {mockPreviewText}
            </div>
          </div>
        </GlassCard>

        {/* Retrain */}
        <div className="p-px rounded-[var(--r-lg)] bg-gradient-to-br from-tiger to-ember">
          <GlassCard className="p-6 !border-0 h-full">
            <h3 className="font-display text-base font-bold text-fg mb-2">
              Learn from my edits
            </h3>
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
                <Stripe active className="h-1" />
                <p className="font-mono text-[11px] text-fg-faint">learning…</p>
              </motion.div>
            )}

            <GlassButton onClick={handleRetrain} disabled={isRetraining} variant="primary" size="sm">
              Learn from my edits
            </GlassButton>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
