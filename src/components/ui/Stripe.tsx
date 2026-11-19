import React from 'react'
import clsx from 'clsx'

export interface StripeProps {
  className?: string
  /** Whether the tiger is working — scrolls the pencil hatching. */
  active?: boolean
}

/**
 * The signature diagonal pencil-hatch bar (formerly tiger stripes). Always
 * renders the static pattern; only animates while `active`.
 */
export const Stripe: React.FC<StripeProps> = ({ className, active = false }) => {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={clsx('hatch h-1.5 w-full rounded-full', active && 'hatch-animate', className)}
    />
  )
}
