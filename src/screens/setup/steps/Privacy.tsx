import React from 'react'
import { FolderLock, Cpu, ShieldCheck, HardDrive, type LucideIcon } from 'lucide-react'
import { GlassButton } from '../../../components/ui'
import { useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FolderLock, title: 'Your files stay on this Mac', body: 'PDFs, images and documents are read here and never copied elsewhere.' },
  { icon: Cpu, title: 'Models run locally', body: 'OCR and writing happen on this machine through Ollama.' },
  { icon: ShieldCheck, title: 'Nothing is uploaded or tracked', body: 'No accounts, no analytics, no cloud calls.' },
  { icon: HardDrive, title: 'Everything lives in the app data folder', body: 'Your sources, drafts and settings are stored on this Mac, and only there.' },
]

export const Privacy: React.FC = () => {
  const { next, returnToDone } = useWizard()
  return (
    <div>
      <Heading className="mb-2">What on-device means</Heading>
      <p className="text-sm text-fg-muted mb-5">Paper Tiger works without a network once the models are downloaded.</p>

      <ul className="space-y-3">
        {POINTS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className={`flex items-start gap-3 p-3.5 ${i % 2 ? 'sketch-alt' : 'sketch'}`}>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-rose/40 border-2 border-[var(--line)] wobble">
              <Icon size={16} aria-hidden="true" className="text-fg" />
            </span>
            <div>
              <p className="font-display text-[19px] leading-tight text-fg">{title}</p>
              <p className="text-sm text-fg-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next}>
          {returnToDone ? 'Back to summary' : 'Sounds good'}
        </GlassButton>
      </WizardActions>
    </div>
  )
}
