import React from 'react'
import clsx from 'clsx'
import { GlassCard, GlassButton, Chip } from '../../../components/ui'
import { writerFit } from '../../../lib/hardware'
import { WRITER_FAMILIES, WRITER_MODELS, type WriterFamily } from '../../../lib/models'
import { useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const WRITER_FAMILY_ORDER: WriterFamily[] = ['qwen', 'gemma', 'deepseek']
const fmtGb = (n: number) => n.toFixed(1)

export const Writer: React.FC = () => {
  const { hw, effectiveWriterVariantId, setSelectedWriterVariantId, writerRecommendation, useThisWriter, skipWriter } =
    useWizard()

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Heading>Choose a writer</Heading>
        <Chip tone="tiger" mono>
          Optional
        </Chip>
      </div>
      <p className="text-sm text-fg-muted mb-5">Optional. You can add or change it later in Settings.</p>

      {!hw ? (
        <p className="font-mono text-sm text-fg-faint">Reading your Mac…</p>
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
                          <p className={clsx('font-mono text-[11px] mt-0.5', isSelected ? 'text-on-tiger/70' : 'text-fg-faint')}>
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

          {writerRecommendation && <p className="text-sm text-fg-muted">{writerRecommendation.reason}</p>}
        </>
      )}

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={useThisWriter} disabled={!hw || !effectiveWriterVariantId}>
          Use this writer
        </GlassButton>
        <GlassButton variant="ghost" size="lg" onClick={skipWriter}>
          Skip for now
        </GlassButton>
      </WizardActions>
    </div>
  )
}
