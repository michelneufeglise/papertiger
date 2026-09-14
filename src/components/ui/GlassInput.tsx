import React from 'react'
import clsx from 'clsx'

const fieldStyles = clsx(
  'bg-[var(--panel-2)] border border-line rounded-[var(--r-md)]',
  'text-fg placeholder:text-fg-faint',
  'px-3.5 py-2.5 text-sm outline-none',
  'transition-[border-color,box-shadow] duration-150',
  'focus:border-tiger/60 focus:shadow-[0_0_0_3px_rgba(255,107,26,0.18)]',
  'disabled:opacity-40 disabled:pointer-events-none'
)

export interface GlassInputProps extends React.ComponentProps<'input'> {
  className?: string
}

export const GlassInput: React.FC<GlassInputProps> = ({ className, ...props }) => {
  return <input className={clsx(fieldStyles, className)} {...props} />
}

export interface GlassTextareaProps extends React.ComponentProps<'textarea'> {
  className?: string
}

export const GlassTextarea: React.FC<GlassTextareaProps> = ({ className, ...props }) => {
  return <textarea className={clsx(fieldStyles, 'resize-none', className)} {...props} />
}
