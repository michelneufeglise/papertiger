import React from 'react'
import { SketchFrame, Tiger } from '../../components/ui'
import type { TigerState } from '../../lib/tiger'

const tailProps = {
  fill: 'var(--panel)',
  stroke: 'var(--line)',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Paper Tiger beside a hand-drawn speech bubble. Stacks when the container is under ~720px. */
export const GuideTiger: React.FC<{ state: TigerState; line: string }> = ({ state, line }) => (
  <div className="@container shrink-0 mb-3">
    <div className="flex flex-col items-center gap-1 @[720px]:flex-row @[720px]:items-center @[720px]:gap-0">
      <Tiger state={state} size={120} className="shrink-0 -rotate-2" />
      <div className="relative w-full @[720px]:flex-1 @[720px]:ml-3">
        {/* tail: points up (stacked) */}
        <svg
          aria-hidden="true"
          width="30"
          height="18"
          viewBox="0 0 30 18"
          className="absolute -top-[15px] left-1/2 -ml-4 z-10 @[720px]:hidden"
        >
          <path d="M3 18 C10 14 12 7 14 2 C17 8 22 13 28 18" {...tailProps} />
          <path d="M4 18.5 L27 18.5" stroke="var(--panel)" strokeWidth={4} />
        </svg>
        {/* tail: points left (side by side) */}
        <svg
          aria-hidden="true"
          width="18"
          height="30"
          viewBox="0 0 18 30"
          className="absolute top-1/2 -left-[15px] -mt-4 z-10 hidden @[720px]:block"
        >
          <path d="M18 3 C14 10 7 12 2 14 C8 17 13 22 18 28" {...tailProps} />
          <path d="M18.5 4 L18.5 27" stroke="var(--panel)" strokeWidth={4} />
        </svg>
        <SketchFrame seed={41} radius={16} className="px-5 py-3.5">
          <p aria-live="polite" className="font-display text-[19px] leading-snug text-fg">
            {line}
          </p>
        </SketchFrame>
      </div>
    </div>
  </div>
)
