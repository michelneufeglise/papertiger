import React from 'react'
import { SketchFrame } from './SketchFrame'
import { Tiger } from './Tiger'
import { tigerLabel, useTigerCycle, useTigerStatus } from '../../lib/tiger'

const TIGER_SIZE = 128

/**
 * The big tiger, illustration only. Shows the live status pose while busy, else the 5 s idle
 * cycle. There is no visible caption; status changes are still announced to screen readers
 * through a hidden live region (the idle cycle is never announced).
 */
export const TigerCard: React.FC = () => {
  const status = useTigerStatus()
  const cycled = useTigerCycle()
  const shown = status ?? cycled
  const label = tigerLabel(shown)
  return (
    <SketchFrame
      seed={4}
      radius={18}
      data-tauri-drag-region
      className="shrink-0 flex items-center justify-center p-3 select-none"
    >
      <Tiger state={shown} size={TIGER_SIZE} alt={label} className="pointer-events-none" />
      <p aria-live="polite" className="sr-only">
        {status ? tigerLabel(status) : ''}
      </p>
    </SketchFrame>
  )
}
