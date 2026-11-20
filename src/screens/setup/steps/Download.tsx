import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'
import { GlassCard, GlassButton, Chip } from '../../../components/ui'
import { useGuide, useWizard, type RowStatus } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const fmtGb = (n: number) => n.toFixed(1)

export const Download: React.FC = () => {
  const {
    downloadRows,
    rowStatus,
    rowProgress,
    downloadError,
    allRowsReady,
    anyRowPulling,
    anyRowError,
    effectiveModel,
    writerModel,
    cancelDownload,
    goTo,
    next, returnToDone,
  } = useWizard()

  useGuide(
    'download',
    anyRowError
      ? { tiger: 'erasing-mistake', line: 'Oops, that download did not work. Check your connection, then go back and try again.' }
      : allRowsReady
        ? { tiger: 'finished-page', line: 'All your models are ready!' }
        : anyRowPulling
          ? { tiger: 'busy' }
          : null,
  )

  return (
    <div>
      <Heading className="mb-2">Setting up your models</Heading>
      <p className="text-sm text-fg-muted mb-5">
        {downloadRows.length > 1 ? `${effectiveModel.label}, then ${writerModel?.label ?? 'your writer'}.` : effectiveModel.label}
      </p>

      <div className="space-y-4">
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

      <WizardActions>
        {anyRowPulling && (
          <GlassButton variant="ghost" size="lg" icon={<X size={16} />} onClick={cancelDownload}>
            Cancel
          </GlassButton>
        )}
        {allRowsReady && (
          <GlassButton variant="primary" size="lg" icon={<CheckCircle2 size={16} />} onClick={next}>
            {returnToDone ? 'Back to summary' : 'Continue'}
          </GlassButton>
        )}
        {anyRowError && (
          <GlassButton variant="secondary" size="lg" onClick={() => goTo('writer')}>
            Choose again
          </GlassButton>
        )}
      </WizardActions>
    </div>
  )
}
