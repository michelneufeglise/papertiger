import React from 'react'
import clsx from 'clsx'

export interface TitleBarProps {
  title?: string
  className?: string
  children?: React.ReactNode
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title = 'papertiger',
  className,
  children,
}) => {
  return (
    <header
      data-tauri-drag-region
      className={clsx(
        'glass h-11 flex items-center justify-between shrink-0',
        'pl-[88px] pr-4 select-none',
        className
      )}
    >
      <span className="font-display font-bold text-[15px] text-fg truncate">{title}</span>

      <div className="flex items-center gap-2">
        {children}
        <span
          data-tauri-drag-region="false"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[var(--panel-2)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-mint" />
          100% on-device
        </span>
      </div>
    </header>
  )
}
