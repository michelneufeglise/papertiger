import React from 'react'
import clsx from 'clsx'
import { Tiger } from './Tiger'

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
        'h-11 flex items-center justify-between shrink-0 bg-panel border-b-2 border-[var(--line)]',
        'pl-[88px] pr-4 select-none',
        className
      )}
    >
      <span className="font-display text-[20px] text-fg truncate">{title}</span>

      <div className="flex items-center gap-2">
        {children}
        <span
          data-tauri-drag-region="false"
          className="wobble inline-flex items-center gap-1.5 border-2 border-[var(--line)] bg-panel-2 pl-1 pr-3 h-8 font-display text-[15px] text-fg"
        >
          <Tiger cycle size={24} />
          <span className="inline-block w-2 h-2 rounded-full bg-mint" />
          100% on-device
        </span>
      </div>
    </header>
  )
}
