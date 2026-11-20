import React from 'react'
import { GlassButton } from '../../../components/ui'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

export const Welcome: React.FC = () => {
  const { next } = useWizard()
  const [happy, setHappy] = React.useState(false)
  React.useEffect(() => {
    const t = window.setTimeout(() => setHappy(true), 2200)
    return () => window.clearTimeout(t)
  }, [])
  useGuide('welcome', happy ? { tiger: 'happy' } : null)

  return (
    <div>
      <Heading className="mb-5">Meet papertiger</Heading>
      <ul className="space-y-2.5">
        {['Reads your sources on-device.', 'Writes in your voice.', 'Nothing leaves this Mac.'].map((line) => (
          <li key={line} className="flex items-center gap-2.5 text-[15px] text-fg-muted">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose border-2 border-[var(--line)] shrink-0" />
            {line}
          </li>
        ))}
      </ul>
      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next}>
          Get started
        </GlassButton>
      </WizardActions>
    </div>
  )
}
