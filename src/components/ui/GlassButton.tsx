import React from 'react'
import clsx from 'clsx'

export interface GlassButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  className?: string
}

const sizeStyles: Record<NonNullable<GlassButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-[15px] gap-1.5',
  md: 'h-10 px-4 text-[17px] gap-2',
  lg: 'h-12 px-6 text-[19px] gap-2',
}

const variantStyles: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  primary:
    'sketch-btn bg-tiger text-on-tiger border-2 border-[var(--line)] shadow-[3px_4px_0_var(--line)]',
  secondary:
    'sketch-btn bg-panel text-fg border-2 border-[var(--line)] shadow-[3px_4px_0_var(--line)]',
  ghost: 'bg-transparent text-fg-muted hover:bg-rose/40 hover:text-fg transition-colors',
  danger:
    'sketch-btn bg-panel text-danger border-2 border-danger shadow-[3px_4px_0_var(--danger)]',
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  disabled,
  ...rest
}) => {
  return (
    <button
      className={clsx(
        'wobble inline-flex items-center justify-center font-display select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        'disabled:opacity-40 disabled:pointer-events-none',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
