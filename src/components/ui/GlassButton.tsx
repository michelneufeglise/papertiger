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
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

const variantStyles: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  primary: 'bg-tiger text-[#0E0D12] font-semibold hover:brightness-[1.08] shadow-sm',
  secondary: 'bg-[var(--panel-2)] border border-line text-fg hover:brightness-[1.12]',
  ghost: 'bg-transparent text-fg-muted hover:bg-[var(--panel-2)] hover:text-fg',
  danger: 'bg-transparent text-rose hover:bg-rose/15',
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
        'inline-flex items-center justify-center rounded-full font-medium select-none',
        'transition-[filter,background-color,transform] duration-150 ease-out',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger focus-visible:ring-offset-0',
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
