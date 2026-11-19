import React from 'react'
import clsx from 'clsx'

export interface KbdProps {
  children: React.ReactNode
  className?: string
}

/** Sketched keycap. */
export const Kbd: React.FC<KbdProps> = ({ children, className }) => {
  return (
    <kbd
      className={clsx(
        'inline-flex items-center justify-center font-mono text-[10px] leading-none',
        'bg-panel border-[1.5px] border-[var(--line)] rounded-[5px_3px_6px_3px] px-1.5 py-1 text-fg-muted',
        'shadow-[1px_2px_0_var(--line)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}
