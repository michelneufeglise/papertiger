import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { sketchRoundedRect, sketchSecondPass } from '../../lib/sketchPath'

export interface SketchFrameProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  seed: number
  radius?: number
  shadow?: boolean
  fill?: boolean
  strokeOpacity?: number
  /** 'hidden' wraps children in a rounded clipping layer (the drawn lines stay unclipped). */
  overflow?: 'hidden' | 'visible'
  /** Classes for the clipping wrapper when overflow is 'hidden'. */
  innerClassName?: string
  as?: React.ElementType
  children?: React.ReactNode
}

export const SketchFrame = React.forwardRef<HTMLElement, SketchFrameProps>(function SketchFrame(
  {
    seed,
    radius = 18,
    shadow = true,
    fill = true,
    strokeOpacity = 1,
    overflow = 'visible',
    innerClassName,
    as: Tag = 'div',
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const localRef = useRef<HTMLElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = localRef.current
    if (!el) return
    const update = () => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      setSize(s => (s.w === w && s.h === h ? s : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const main = useMemo(() => (w > 0 && h > 0 ? sketchRoundedRect(w, h, radius, seed) : ''), [w, h, radius, seed])
  const second = useMemo(() => (w > 0 && h > 0 ? sketchSecondPass(w, h, radius, seed) : ''), [w, h, radius, seed])
  // Closed outline for fill/shadow (the stroke path is open).
  const body = useMemo(() => (main ? `${main}Z` : ''), [main])

  const setRef = (node: HTMLElement | null) => {
    localRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node
  }

  return (
    <Tag
      ref={setRef}
      className={clsx(!/\b(absolute|fixed|sticky)\b/.test(className ?? '') && 'relative', 'isolate', className)}
      style={{ borderRadius: radius, ...style }}
      {...rest}
    >
      {w > 0 && (
        <svg
          aria-hidden="true"
          width={w}
          height={h}
          className="absolute inset-0 pointer-events-none -z-10"
          style={{ overflow: 'visible' }}
        >
          {shadow && (
            <path d={body} transform="translate(3 4)" fill="var(--line)" fillOpacity={0.18} stroke="none" />
          )}
          {fill && <path d={body} fill="var(--panel)" stroke="none" />}
          <path
            d={main}
            fill="none"
            stroke="var(--line)"
            strokeOpacity={strokeOpacity}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={second}
            fill="none"
            stroke="var(--line)"
            strokeOpacity={0.45 * strokeOpacity}
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {overflow === 'hidden' ? (
        <div
          className={clsx('relative h-full w-full overflow-hidden flex flex-col min-h-0', innerClassName)}
          style={{ borderRadius: radius }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </Tag>
  )
})
