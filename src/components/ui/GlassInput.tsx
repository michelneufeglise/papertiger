import React from 'react'
import clsx from 'clsx'

const fieldStyles = clsx(
  'bg-panel border-2 border-[var(--line)] rounded-[14px_5px_13px_5px/5px_13px_5px_14px]',
  'text-fg placeholder:text-fg-faint',
  'px-3.5 py-2.5 text-[15px] outline-none',
  'transition-[border-color,box-shadow] duration-150',
  'focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--rose)_70%,transparent)]',
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
