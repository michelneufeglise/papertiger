import React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { Tiger } from './Tiger'

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
      whileHover={{ rotate: -3, scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={clsx(
        'relative w-full flex flex-col items-center gap-0.5 py-2 rounded-[var(--r-md)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
        className
      )}
    >
      <span className="relative flex h-9 w-12 items-center justify-center">
        {active && (
          <motion.span
            layoutId="rail-highlighter"
            className="highlighter absolute inset-0"
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          />
        )}
        <Icon size={22} className={clsx('relative z-10', active ? 'text-[#2a2522]' : 'text-fg-muted')} />
      </span>
      <span
        className={clsx(
          'font-display text-[16px] leading-none',
          active ? 'text-fg' : 'text-fg-muted'
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={clsx('doodle-underline h-[7px] w-8 transition-opacity', active ? 'opacity-100' : 'opacity-0')}
      />
    </motion.button>
  )
}

export interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({ children, className }) => {
  return (
    <aside
      className={clsx(
        'w-[84px] shrink-0 h-full flex flex-col items-center gap-1 py-3 px-1.5',
        'bg-panel border-r-2 border-[var(--line)] overflow-y-auto',
        className
      )}
    >
      <Tiger cycle size={56} className="mb-2" alt="papertiger" />
      {children}
    </aside>
  )
}
