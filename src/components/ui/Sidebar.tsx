import React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { SketchFrame } from './SketchFrame'

export interface SidebarItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  className,
}) => {
  return (
    <motion.button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      whileHover={{ rotate: -1, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={clsx(
        'relative w-full h-11 flex items-center gap-3 px-3 rounded-[var(--r-md)] text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
        className
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-highlighter"
          className="highlighter absolute inset-0"
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        />
      )}
      <Icon size={20} className={clsx('relative z-10 shrink-0', active ? 'text-[#2a2522]' : 'text-fg-muted')} />
      <span
        className={clsx(
          'relative z-10 font-display text-[17px] leading-none truncate',
          active ? 'text-[#2a2522]' : 'text-fg-muted'
        )}
      >
        {label}
      </span>
    </motion.button>
  )
}

export interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({ children, className }) => {
  return (
    <SketchFrame
      as="aside"
      seed={2}
      radius={18}
      overflow="hidden"
      className={clsx('w-full flex-1 min-h-0', className)}
      innerClassName="items-stretch gap-1 p-2 overflow-y-auto"
    >
      <nav aria-label="Main" className="flex flex-col items-stretch gap-1">
        {children}
      </nav>
    </SketchFrame>
  )
}
