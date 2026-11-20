import React from 'react'
import { GlassCard, GlassButton } from '../../../components/ui'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const fmtGb = (n: number) => n.toFixed(1)

export const YourMac: React.FC = () => {
  const { hw, next, returnToDone } = useWizard()
  useGuide('mac', hw ? { tiger: 'happy', line: 'Nice Mac! I will use this to recommend models that fit it.' } : null)

  return (
    <div>
      <Heading className="mb-2">Your Mac</Heading>
      <p className="text-sm text-fg-muted mb-5">We use this to recommend models that fit your hardware.</p>

      <GlassCard className="p-6 -rotate-[0.4deg]">
        {!hw ? (
          <p className="font-mono text-sm text-fg-faint">Reading your Mac…</p>
        ) : (
          <dl className="grid grid-cols-[120px_1fr] gap-y-3.5 items-center">
            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Chip</dt>
            <dd className="font-mono text-sm text-fg">{hw.source === 'browser' ? 'Browser preview' : hw.chip}</dd>

            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Memory</dt>
            <dd className="font-mono text-sm text-fg">{hw.ramGb > 0 ? `${fmtGb(hw.ramGb)} GB` : '—'}</dd>

            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">macOS</dt>
            <dd className="font-mono text-sm text-fg">{hw.source === 'tauri' && hw.macosVersion ? hw.macosVersion : '—'}</dd>

            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Cores</dt>
            <dd className="font-mono text-sm text-fg">{hw.cpuCores || '—'}</dd>
          </dl>
        )}
      </GlassCard>

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next}>
          {returnToDone ? 'Back to summary' : 'Continue'}
        </GlassButton>
      </WizardActions>
    </div>
  )
}
