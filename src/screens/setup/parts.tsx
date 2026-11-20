import React from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { useWizard } from './WizardContext'

/** Step heading. Focused automatically when its step opens (h1, tabIndex -1). */
export const Heading: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h1 tabIndex={-1} className={clsx('font-display text-[34px] leading-none text-fg outline-none', className)}>
    <span className="doodle-underline">{children}</span>
  </h1>
)

/**
 * Renders its children in the wizard footer (bottom-left, next to Back).
 * Use it for the step's primary/secondary buttons so they stay visible
 * while the step body scrolls.
 */
export const WizardActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { footerEl } = useWizard()
  return footerEl ? createPortal(children, footerEl) : null
}
