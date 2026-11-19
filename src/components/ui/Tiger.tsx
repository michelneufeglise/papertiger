import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { tigerSrc, useTigerCycle, useTigerStatus, type TigerState } from '../../lib/tiger'

export interface TigerProps {
  /** Fixed expression. Ignored while `cycle` is on. */
  state?: TigerState
  /** Follow the global 5 s cycle, pinned to a mood while the app is busy. */
  cycle?: boolean
  size?: number
  className?: string
  alt?: string
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const CycleSprite: React.FC = () => {
  const cycled = useTigerCycle()
  const status = useTigerStatus()
  return <Sprite state={status ?? cycled} />
}

const Sprite: React.FC<{ state: TigerState; alt?: string }> = ({ state, alt = '' }) => (
  <AnimatePresence mode="popLayout" initial={false}>
    <motion.img
      key={state}
      src={tigerSrc(state)}
      alt={alt}
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-contain"
      initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0.6, rotate: 12, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'backOut' }}
    />
  </AnimatePresence>
)

/**
 * The papertiger mascot. Night mode seats it on a cream "sticker" disc so the
 * graphite line work stays readable.
 */
export const Tiger: React.FC<TigerProps> = ({
  state = 'idle',
  cycle = false,
  size = 48,
  className,
  alt = '',
}) => {
  const dark = useIsDark()
  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={clsx(
        'relative shrink-0',
        dark && 'rounded-full border-2 border-[var(--line)]',
        className
      )}
      style={{ width: size, height: size, background: dark ? '#fbf6ea' : undefined }}
    >
      <div className={clsx('absolute', dark ? 'inset-[6%] overflow-visible' : 'inset-0')}>
        {cycle ? <CycleSprite /> : <Sprite state={state} />}
      </div>
    </div>
  )
}
