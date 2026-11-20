import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { GlassButton } from '../../../components/ui'
import { updateSettings, useSettings } from '../../../lib/settings'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const OPTIONS = [
  {
    value: true,
    label: "Use the text when it's there",
    blurb: 'Fast and exact. Digital PDFs need no OCR; scanned pages still use OCR.',
    recommended: true,
  },
  {
    value: false,
    label: 'Always use OCR',
    blurb: 'Slower, but keeps table layout better.',
    recommended: false,
  },
]

export const PdfText: React.FC = () => {
  const { next, returnToDone } = useWizard()
  const { pdfTextLayer } = useSettings()
  useGuide(
    'pdf',
    pdfTextLayer ? null : { tiger: 'opening-book', line: 'Every page gets read by the OCR model. Slower, but tables keep their shape.' },
  )

  return (
    <div>
      <Heading className="mb-2">How to read PDFs</Heading>
      <p className="text-sm text-fg-muted mb-5">Many PDFs already contain their text. You can change this later in Settings.</p>

      <div role="radiogroup" aria-label="PDF reading method" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const selected = pdfTextLayer === opt.value
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => updateSettings({ pdfTextLayer: opt.value })}
              className={clsx(
                'relative text-left p-5 transition-colors sketch-btn',
                opt.recommended ? 'sketch-alt' : 'sketch',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                selected ? 'bg-rose/40' : 'hover:bg-[var(--panel-2)]',
              )}
            >
              {opt.recommended && (
                <span className="absolute -top-3 right-3 rotate-3 bg-rose border-2 border-[var(--line)] px-2.5 py-0.5 font-display text-[16px] leading-none text-fg wobble">
                  recommended
                </span>
              )}
              {selected && (
                <motion.div
                  layoutId="pdf-pill"
                  className="absolute inset-1 wobble-alt border-2 border-dashed border-[var(--line)] pointer-events-none"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <p className="font-display text-[22px] leading-tight text-fg mb-2">{opt.label}</p>
              <p className="text-sm text-fg-muted">{opt.blurb}</p>
            </button>
          )
        })}
      </div>

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next}>
          {returnToDone ? 'Back to summary' : 'Continue'}
        </GlassButton>
      </WizardActions>
    </div>
  )
}
