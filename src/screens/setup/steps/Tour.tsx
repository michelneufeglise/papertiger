import React from 'react'
import { MessageSquare, FolderOpen, PenLine, Wand2, type LucideIcon } from 'lucide-react'
import { GlassButton } from '../../../components/ui'
import type { TigerState } from '../../../lib/tiger'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

interface TourCard {
  key: string
  label: string
  icon: LucideIcon
  text: string
  tiger: TigerState
  line: string
}

const CARDS: TourCard[] = [
  {
    key: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    text: 'Tell me what your paper is about and what you need. I remember it.',
    tiger: 'talking',
    line: 'Chat is where we talk. Tell me your idea in your own words.',
  },
  {
    key: 'sources',
    label: 'Sources',
    icon: FolderOpen,
    text: 'Drop in PDFs, Word files and photos. I read them and keep the text.',
    tiger: 'focused-reading',
    line: 'Sources is my reading desk. I go through everything you add.',
  },
  {
    key: 'draft',
    label: 'Draft',
    icon: PenLine,
    text: 'Your paper, section by section. I write, and you edit anything.',
    tiger: 'writing-intently',
    line: 'Draft is where the paper grows. You always have the last word.',
  },
  {
    key: 'humanize',
    label: 'Humanize',
    icon: Wand2,
    text: 'Make a text sound like a person wrote it, and review every change.',
    tiger: 'erasing-mistake',
    line: 'Humanize is my eraser. I rewrite stiff text and you check each change.',
  },
]

export const Tour: React.FC = () => {
  const { next, returnToDone } = useWizard()
  const [active, setActive] = React.useState<TourCard | null>(null)
  useGuide('tour', active ? { tiger: active.tiger, line: active.line } : null)

  return (
    <div>
      <Heading className="mb-2">Quick tour</Heading>
      <p className="text-sm text-fg-muted mb-5">Four places you will use. Point at one and I will show you.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.key}
              type="button"
              onMouseEnter={() => setActive(c)}
              onMouseLeave={() => setActive((a) => (a === c ? null : a))}
              onFocus={() => setActive(c)}
              onBlur={() => setActive((a) => (a === c ? null : a))}
              className="text-left p-4 sketch sketch-btn transition-colors hover:bg-[var(--panel-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            >
              <span className="flex items-center gap-2 mb-1.5">
                <Icon size={20} aria-hidden className="text-fg" />
                <span className="font-display text-[22px] leading-tight text-fg">{c.label}</span>
              </span>
              <span className="block text-sm text-fg-muted">{c.text}</span>
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
