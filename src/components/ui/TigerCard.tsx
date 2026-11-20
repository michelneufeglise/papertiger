import React from 'react'
import { SketchFrame } from './SketchFrame'
import { Tiger } from './Tiger'
import { tigerLabel, useTigerCycle, useTigerStatus } from '../../lib/tiger'

const TIGER_SIZE = 128

/** The big tiger with a caption. Shows the live status while busy, else the 5 s idle cycle. */
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
      className="shrink-0 flex flex-col items-center p-3 select-none"
    >
      <Tiger state={shown} size={TIGER_SIZE} alt={label} className="pointer-events-none" />
      <p
        aria-hidden="true"
        className={
          'pointer-events-none mt-1.5 w-full text-center truncate font-display text-[17px] leading-tight ' +
          (status ? 'text-fg' : 'text-fg-muted')
        }
      >
        {label}
      </p>
      {status && (
        <span
          aria-hidden="true"
          className="hatch hatch-animate pointer-events-none mt-1 block h-1 w-10 rounded-full"
        />
      )}
      <p aria-live="polite" className="sr-only">
        {status ? tigerLabel(status) : ''}
      </p>
    </SketchFrame>
  )
}
