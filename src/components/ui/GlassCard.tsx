import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export interface GlassCardProps {
  children: React.ReactNode
  className?: string
  /** 'raised' is the current name; 'elevated' kept for backwards compatibility. */
  variant?: 'default' | 'raised' | 'elevated'
  as?: React.ElementType
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  variant = 'default',
  as,
}) => {
  // Memoize so the motion-wrapped tag isn't recreated (and remounted) on every render.
  const Component = React.useMemo(
    () => motion.create(as ?? 'div') as React.ElementType,
    [as]
  )
  const raised = variant === 'raised' || variant === 'elevated'

  return (
    <Component
      className={clsx(
        'glass relative rounded-[var(--r-lg)]',
        raised && 'bg-[var(--panel-2)]',
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </Component>
  )
}
