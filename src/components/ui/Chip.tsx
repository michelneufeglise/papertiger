import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Stripe } from './Stripe'

export type ChipTone = 'neutral' | 'tiger' | 'mint' | 'rose'
/** Legacy tone names, kept so existing call sites keep compiling. */
export type LegacyChipColor = 'neutral' | 'success' | 'processing' | 'error'

const legacyToneMap: Record<LegacyChipColor, ChipTone> = {
  neutral: 'neutral',
  success: 'mint',
  processing: 'tiger',
  error: 'rose',
}

const toneStyles: Record<ChipTone, string> = {
  neutral: 'bg-[var(--panel-2)] border-line text-fg-muted',
  tiger: 'bg-tiger/15 border-tiger/30 text-tiger',
  mint: 'bg-mint/15 border-mint/30 text-mint',
  rose: 'bg-rose/15 border-rose/30 text-rose',
}

export interface ChipProps {
  children: React.ReactNode
  /** Preferred prop. */
  tone?: ChipTone
  /** Legacy prop kept for backwards compatibility with existing screens. */
  color?: LegacyChipColor
  mono?: boolean
  className?: string
  onRemove?: () => void
}

export const Chip: React.FC<ChipProps> = ({
  children,
  tone,
  color,
  mono = false,
  className,
  onRemove,
}) => {
  const resolvedTone = tone ?? (color ? legacyToneMap[color] : 'neutral')

  return (
    <motion.div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] leading-none',
        mono && 'font-mono uppercase tracking-[0.08em]',
        toneStyles[resolvedTone],
        className
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      <span>{children}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="leading-none opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </motion.div>
  )
}

export type StatusChipStatus = 'idle' | 'processing' | 'success' | 'error'
/** Legacy status names, kept so existing call sites keep compiling. Only 'neutral' differs from the current API. */
export type LegacyStatusChipStatus = 'neutral' | 'success' | 'processing' | 'error'

const statusDotStyles: Record<StatusChipStatus, string> = {
  idle: 'bg-fg-faint',
  processing: 'bg-tiger',
  success: 'bg-mint',
  error: 'bg-rose',
}

const statusTextStyles: Record<StatusChipStatus, string> = {
  idle: 'text-fg-muted border-line bg-[var(--panel-2)]',
  processing: 'text-tiger border-tiger/30 bg-tiger/15',
  success: 'text-mint border-mint/30 bg-mint/15',
  error: 'text-rose border-rose/30 bg-rose/15',
}

export interface StatusChipProps {
  children: React.ReactNode
  status?: StatusChipStatus | LegacyStatusChipStatus
  className?: string
}

export const StatusChip: React.FC<StatusChipProps> = ({
  children,
  status = 'idle',
  className,
}) => {
  const resolved: StatusChipStatus = status === 'neutral' ? 'idle' : status

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono uppercase tracking-[0.08em] leading-none',
        statusTextStyles[resolved],
        className
      )}
    >
      {resolved === 'processing' ? (
        <Stripe active className="w-3 h-1.5 rounded-[2px]" />
      ) : (
        <span className={clsx('inline-block w-1.5 h-1.5 rounded-full', statusDotStyles[resolved])} />
      )}
      <span>{children}</span>
    </div>
  )
}
