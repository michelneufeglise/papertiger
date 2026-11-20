import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { GlassButton } from '../../../components/ui'
import { OCR_MODELS } from '../../../lib/models'
import { useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const fmtGb = (n: number) => n.toFixed(1)

export const OcrModel: React.FC = () => {
  const { effectiveQuant, recommendation, selectQuant, confirmOcr } = useWizard()
  return (
    <div>
      <Heading className="mb-2">Choose an OCR model</Heading>
      <p className="text-sm text-fg-muted mb-5">Both read text the same way. The difference is memory and speed.</p>

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

      {recommendation && <p className="text-sm text-fg-muted">{recommendation.reason}</p>}

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={confirmOcr}>
          Use this model
        </GlassButton>
      </WizardActions>
    </div>
  )
}
