import React from 'react'
import clsx from 'clsx'
import { GlassButton } from '../../../components/ui'
import { THEME_LABELS, useTheme, type ThemeMode } from '../../../lib/theme'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const OPTIONS: { mode: ThemeMode; blurb: string }[] = [
  { mode: 'light', blurb: 'Cream paper and pencil lines. Easy on the eyes by day.' },
  { mode: 'dark', blurb: 'Dark ink with chalk lines. Calm for late nights.' },
  { mode: 'system', blurb: 'Follows your Mac: light by day, dark at night.' },
]

const Swatch: React.FC<{ paper: string; ink: string; line: string }> = ({ paper, ink, line }) => (
  <span
    aria-hidden
    className="block h-14 w-full wobble border-2 border-[var(--line)] px-3 py-2 overflow-hidden"
    style={{ background: paper }}
  >
    <span className="block font-display text-[18px] leading-none" style={{ color: ink }}>
      Aa paper
    </span>
    <span className="block mt-2 h-[3px] w-4/5 rounded-full" style={{ background: line }} />
    <span className="block mt-1.5 h-[3px] w-3/5 rounded-full" style={{ background: line }} />
  </span>
)

const SWATCHES: Record<ThemeMode, React.ReactNode> = {
  light: <Swatch paper="#f6efdd" ink="#2b2b2b" line="#2b2b2b" />,
  dark: <Swatch paper="#1d1b19" ink="#f1ead9" line="#f1ead9" />,
  system: (
    <span aria-hidden className="grid grid-cols-2 h-14 w-full wobble border-2 border-[var(--line)] overflow-hidden">
      <span className="block px-2 py-2" style={{ background: '#f6efdd' }}>
        <span className="block font-display text-[18px] leading-none" style={{ color: '#2b2b2b' }}>
          Aa
        </span>
        <span className="block mt-2 h-[3px] w-4/5 rounded-full" style={{ background: '#2b2b2b' }} />
      </span>
      <span className="block px-2 py-2" style={{ background: '#1d1b19' }}>
        <span className="block font-display text-[18px] leading-none" style={{ color: '#f1ead9' }}>
          Aa
        </span>
        <span className="block mt-2 h-[3px] w-4/5 rounded-full" style={{ background: '#f1ead9' }} />
      </span>
    </span>
  ),
}

export const Look: React.FC = () => {
  const { next, returnToDone } = useWizard()
  const { mode, setMode } = useTheme()
  useGuide(
    'look',
    mode === 'dark' ? { tiger: 'chilling', line: 'Night mode, nice. I will keep the lights low for you.' } : null,
  )

  return (
    <div>
      <Heading className="mb-2">Pick your look</Heading>
      <p className="text-sm text-fg-muted mb-5">Try them: the whole app changes right now. You can switch any time in Settings.</p>

      <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPTIONS.map(({ mode: m, blurb }) => {
          const selected = m === mode
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(m)}
              className={clsx(
                'text-left p-4 transition-colors sketch-btn sketch',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                selected ? 'bg-rose/40' : 'hover:bg-[var(--panel-2)]',
              )}
            >
              {SWATCHES[m]}
              <p className="font-display text-[22px] leading-tight text-fg mt-3 mb-1">
                {THEME_LABELS[m]}
                {selected && <span className="sr-only"> (selected)</span>}
              </p>
              <p className="text-sm text-fg-muted">{blurb}</p>
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
