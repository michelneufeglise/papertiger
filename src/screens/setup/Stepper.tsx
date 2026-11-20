import React from 'react'
import clsx from 'clsx'
import { CHAPTERS, STEPS, type StepId } from './steps'

export const Stepper: React.FC<{ step: StepId }> = ({ step }) => {
  const index = STEPS.findIndex((s) => s.id === step)
  const chapter = STEPS[index].chapter
  const chapterIndex = CHAPTERS.indexOf(chapter)
  const inChapter = STEPS.filter((s) => s.chapter === chapter)

  return (
    <div className="shrink-0 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {CHAPTERS.map((label, i) => {
          const isCurrent = i === chapterIndex
          const isDone = i < chapterIndex
          return (
            <div
              key={label}
              className={clsx(
                'font-display text-[18px] leading-none px-1.5 py-1',
                isCurrent ? 'highlighter -rotate-2 text-fg' : isDone ? 'text-fg-muted line-through decoration-2' : 'text-fg-faint',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCurrent ? <span className="doodle-underline">{label}</span> : label}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-fg-faint">
          Step {index + 1} of {STEPS.length}
        </span>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {inChapter.map((s) => (
            <span
              key={s.id}
              className={clsx(
                'inline-block w-2 h-2 rounded-full border-[1.5px] border-[var(--line)]',
                s.id === step ? 'bg-rose' : STEPS.findIndex((x) => x.id === s.id) < index ? 'bg-[var(--line)]' : 'bg-transparent',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
