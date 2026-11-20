import React from 'react'
import { FolderOpen, MessageSquare } from 'lucide-react'
import { GlassButton } from '../../../components/ui'
import { readSettings } from '../../../lib/settings'
import { THEME_LABELS, useTheme } from '../../../lib/theme'
import { useVoice } from '../../../lib/voice'
import type { StepId } from '../steps'
import { useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const fmtGb = (n: number) => n.toFixed(1)

export const Done: React.FC = () => {
  const { effectiveModel, writerModel, fromSettings, finish, goTo } = useWizard()
  const { mode } = useTheme()
  const voice = useVoice()
  const pdfTextLayer = readSettings().pdfTextLayer

  const rows: { id: StepId; label: string; value: string; note?: string; change: string }[] = [
    {
      id: 'ocr',
      label: 'Reading model',
      value: effectiveModel.label,
      note: `${fmtGb(effectiveModel.residentGb)} GB in memory when in use`,
      change: 'Change OCR model',
    },
    {
      id: 'writer',
      label: 'Writer',
      value: writerModel ? writerModel.label : 'Skipped',
      note: writerModel ? `${fmtGb(writerModel.residentGb)} GB in memory when in use` : 'Add one later in Settings',
      change: 'Change writer',
    },
    {
      id: 'pdf',
      label: 'PDF text',
      value: pdfTextLayer ? 'Use the text when it is there' : 'Always use OCR',
      change: 'Change PDF text setting',
    },
    {
      id: 'style',
      label: 'Writing style',
      value: `formal ${voice.formality} · concise ${voice.conciseness} · technical ${voice.technicality}`,
      change: 'Change writing style',
    },
    { id: 'look', label: 'Look', value: THEME_LABELS[mode], change: 'Change look' },
  ]

  return (
    <div>
      <Heading className="mb-3">You're set</Heading>
      <ul className="divide-y divide-dashed divide-[var(--line-soft)]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">{r.label}</p>
              <p className="text-sm text-fg">
                <span className="font-semibold">{r.value}</span>
                {r.note && <span className="text-fg-muted"> · {r.note}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo(r.id, { returnToDone: true })}
              aria-label={r.change}
              className="shrink-0 text-sm text-fg underline decoration-dashed underline-offset-4 hover:bg-rose/40 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            >
              Change
            </button>
          </li>
        ))}
      </ul>

      <WizardActions>
        {fromSettings ? (
          <GlassButton variant="primary" size="lg" onClick={() => finish('/settings')}>
            Back to Settings
          </GlassButton>
        ) : (
          <>
            <GlassButton variant="primary" size="lg" icon={<FolderOpen size={16} />} onClick={() => finish('/references')}>
              Open Sources
            </GlassButton>
            <GlassButton variant="primary" size="lg" icon={<MessageSquare size={16} />} onClick={() => finish('/')}>
              Start chatting
            </GlassButton>
          </>
        )}
      </WizardActions>
    </div>
  )
}
