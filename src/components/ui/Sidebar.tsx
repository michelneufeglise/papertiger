import React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import logo from '../../assets/logo.svg'

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
    <button
      onClick={onClick}
      className={clsx(
        'relative w-full flex flex-col items-center gap-1.5 py-2.5 rounded-[var(--r-md)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger',
        !active && 'hover:bg-[var(--panel-2)]',
        className
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-pill"
          className="absolute inset-0 rounded-[var(--r-md)] bg-tiger"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      <Icon
        size={20}
        className={clsx('relative z-10', active ? 'text-[#0E0D12]' : 'text-fg-muted')}
      />
      <span
        className={clsx(
          'relative z-10 font-mono text-[10px] uppercase tracking-[0.08em]',
          active ? 'text-[#0E0D12]' : 'text-fg-faint'
        )}
      >
        {label}
      </span>
    </button>
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
        'glass w-[72px] shrink-0 h-full flex flex-col items-center gap-1 py-4 px-2',
        'overflow-y-auto',
        className
      )}
    >
      <img src={logo} alt="papertiger" className="mb-3 h-9 w-9 select-none" draggable={false} />
      {children}
    </aside>
  )
}
