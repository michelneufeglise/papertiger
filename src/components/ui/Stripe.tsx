import React from 'react'
import clsx from 'clsx'

export interface StripeProps {
  className?: string
  /** Whether the tiger is working — animates the stripe pattern. */
  active?: boolean
}

/**
 * The signature diagonal tiger-stripe bar. Renders the static pattern always;
 * only animates (background-position shift) while `active`.
 */
export const Stripe: React.FC<StripeProps> = ({ className, active = false }) => {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={clsx('stripes h-1 w-full rounded-full', active && 'stripes-animate', className)}
    />
  )
}
