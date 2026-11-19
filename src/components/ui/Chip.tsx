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

// rose = blush; errors use --danger via the StatusChip 'error' status.
const toneStyles: Record<ChipTone, string> = {
  neutral: 'bg-panel-2 border-[var(--line-soft)] text-fg-muted',
  tiger: 'bg-panel border-[var(--line)] text-fg',
  mint: 'bg-mint/20 border-mint text-mint',
  rose: 'bg-rose/50 border-[var(--line)] text-fg',
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
        'wobble inline-flex items-center gap-1.5 px-3 py-1 border-2 text-[14px] leading-none font-display',
        mono && 'font-mono text-[11px] uppercase tracking-[0.08em]',
        toneStyles[resolvedTone],
        className
      )}
      initial={{ opacity: 0, scale: 0.8, rotate: -4 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
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
  error: 'bg-danger',
}

const statusTextStyles: Record<StatusChipStatus, string> = {
  idle: 'text-fg-muted border-[var(--line-soft)] bg-panel-2',
  processing: 'text-fg border-[var(--line)] bg-rose/50',
  success: 'text-mint border-mint bg-mint/15',
  error: 'text-danger border-danger bg-danger/10',
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
        'wobble inline-flex items-center gap-1.5 px-3 py-1 border-2 text-[11px] font-mono uppercase tracking-[0.08em] leading-none',
        statusTextStyles[resolved],
        className
      )}
    >
      {resolved === 'processing' ? (
        <Stripe active className="w-3 h-2 rounded-[2px]" />
      ) : (
        <span className={clsx('inline-block w-2 h-2 rounded-full', statusDotStyles[resolved])} />
      )}
      <span>{children}</span>
    </div>
  )
}
