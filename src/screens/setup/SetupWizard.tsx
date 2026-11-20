import React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { GlassButton } from '../../components/ui'
import { WizardProvider, useWizard } from './WizardContext'
import { Stepper } from './Stepper'
import { GuideTiger } from './GuideTiger'
import { stepDef, type StepId } from './steps'

import { Welcome } from './steps/Welcome'
import { Privacy } from './steps/Privacy'
import { YourMac } from './steps/YourMac'
import { Ollama } from './steps/Ollama'
import { OcrModel } from './steps/OcrModel'
import { Writer } from './steps/Writer'
import { Download } from './steps/Download'
import { PdfText } from './steps/PdfText'
import { WritingStyle } from './steps/WritingStyle'
import { Look } from './steps/Look'
import { Tour } from './steps/Tour'
import { Done } from './steps/Done'

const STEP_COMPONENTS: Record<StepId, React.FC> = {
  welcome: Welcome,
  privacy: Privacy,
  mac: YourMac,
  ollama: Ollama,
  ocr: OcrModel,
  writer: Writer,
  download: Download,
  pdf: PdfText,
  style: WritingStyle,
  look: Look,
  tour: Tour,
  done: Done,
}

const stepVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
}

const Shell: React.FC = () => {
  const { step, guideOverride, back, anyRowPulling, setFooterEl } = useWizard()
  const reduce = useReducedMotion()
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const def = stepDef(step)
  const Step = STEP_COMPONENTS[step]

  const showBack = step !== 'welcome' && !(step === 'download' && anyRowPulling)

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center px-6 pt-5 pb-4">
      <div className="w-full max-w-[880px] flex-1 min-h-0 flex flex-col">
        <Stepper step={step} />
        <GuideTiger state={guideOverride?.tiger ?? def.tiger} line={guideOverride?.line ?? def.guide} />

        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 26 }}
              onAnimationComplete={(definition) => {
                if (definition === 'animate') bodyRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
              }}
            >
              <Step />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 flex items-center gap-2 pt-3 border-t-2 border-dashed border-[var(--line-soft)]">
          <div ref={setFooterEl} className="flex items-center gap-2" />
          {showBack && (
            <GlassButton variant="ghost" size="lg" onClick={back}>
              Back
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  )
}

export const SetupWizard: React.FC = () => (
  <WizardProvider>
    <Shell />
  </WizardProvider>
)
