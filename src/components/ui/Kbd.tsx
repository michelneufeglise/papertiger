import React from 'react'
import clsx from 'clsx'

export interface KbdProps {
  children: React.ReactNode
  className?: string
}

export const Kbd: React.FC<KbdProps> = ({ children, className }) => {
  return (
    <kbd
      className={clsx(
        'inline-flex items-center justify-center font-mono text-[10px] leading-none',
        'bg-[var(--panel-2)] border border-line rounded-sm px-1.5 py-1 text-fg-muted',
        className
      )}
    >
      {children}
    </kbd>
  )
}
