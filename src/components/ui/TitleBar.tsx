import React from 'react'
import clsx from 'clsx'
import { Tiger } from './Tiger'
import wordmarkUrl from '../../assets/wordmark-paper-tiger.png'

// The window has decorations:false, so there are no macOS traffic lights.
// If they ever appear, raise this (about 80px) to clear them.
const LEFT_INSET_PX = 16
// Aspect ratio (w/h) of src/assets/wordmark-paper-tiger.png (358x96).
const WORDMARK_RATIO = 358 / 96
const WORDMARK_H = 40

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
  const mask = `url(${wordmarkUrl})`
  return (
    <header
      data-tauri-drag-region
      style={{ paddingLeft: LEFT_INSET_PX }}
      className={clsx(
        'h-[72px] flex items-center justify-between shrink-0 bg-panel border-b-2 border-[var(--line)]',
        'pr-4 select-none',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 pointer-events-none">
        <Tiger cycle size={56} className="pointer-events-none shrink-0" alt="papertiger" />
        <span
          role="img"
          aria-label="Paper Tiger"
          className="pointer-events-none shrink-0 bg-fg"
          style={{
            height: WORDMARK_H,
            width: Math.round(WORDMARK_H * WORDMARK_RATIO),
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
        <svg
          aria-hidden="true"
          width="14"
          height="30"
          viewBox="0 0 14 30"
          className="pointer-events-none shrink-0 mx-1"
        >
          <path
            d="M11 2 C8 9 5 19 3 28"
            fill="none"
            stroke="var(--line-soft)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="pointer-events-none font-display text-[18px] text-fg-muted truncate">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2" data-tauri-drag-region>
        {children}
        <span
          data-tauri-drag-region="false"
          className="wobble inline-flex items-center gap-1.5 border-2 border-[var(--line)] bg-panel-2 px-3 h-8 font-display text-[15px] text-fg"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-mint" />
          100% on-device
        </span>
      </div>
    </header>
  )
}
