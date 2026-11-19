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

/** Paper card with a hand-drawn border and hard offset shadow (name kept from the glass era). */
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
      className={clsx('sketch relative', raised && 'bg-[var(--panel-2)]', className)}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
    >
      {children}
    </Component>
  )
}
