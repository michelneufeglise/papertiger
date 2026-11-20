import type { TigerState } from '../../lib/tiger'

export type StepId =
  | 'welcome'
  | 'privacy'
  | 'mac'
  | 'ollama'
  | 'ocr'
  | 'writer'
  | 'download'
  | 'pdf'
  | 'style'
  | 'look'
  | 'tour'
  | 'done'

export const CHAPTERS = ['Hello', 'Your Mac', 'Models', 'Preferences', 'Tour', 'Done'] as const
export type Chapter = (typeof CHAPTERS)[number]

export interface StepDef {
  id: StepId
  chapter: Chapter
  label: string
  /** What Paper Tiger says on this step (first person, 1-2 sentences). */
  guide: string
  /** Default guide pose. Steps can override it live with `useGuide`. */
  tiger: TigerState
  optional?: boolean
}

export const STEPS: StepDef[] = [
  {
    id: 'welcome',
    chapter: 'Hello',
    label: 'Welcome',
    guide: "Hi, I'm Paper Tiger! I'll walk you through setup. It takes about five minutes.",
    tiger: 'waving-bye',
  },
  {
    id: 'privacy',
    chapter: 'Hello',
    label: 'Privacy',
    guide: 'Everything I do happens right here on your Mac. Your files and drafts are never uploaded anywhere.',
    tiger: 'proud',
  },
  {
    id: 'mac',
    chapter: 'Your Mac',
    label: 'Your Mac',
    guide: "Let me take a quick look at your Mac, so I can pick models that run well on it.",
    tiger: 'wonder',
  },
  {
    id: 'ollama',
    chapter: 'Your Mac',
    label: 'Ollama',
    guide: 'I use a small helper app called Ollama to run models on your Mac. Let me check that it is running.',
    tiger: 'thinking',
  },
  {
    id: 'ocr',
    chapter: 'Models',
    label: 'Reading model',
    guide: 'This is the model I use to read scans and photos. I picked the one that fits your Mac best.',
    tiger: 'opening-book',
  },
  {
    id: 'writer',
    chapter: 'Models',
    label: 'Writer',
    guide: 'A writer model helps me draft and rewrite. You can skip this now and add one later in Settings.',
    tiger: 'picking-up-pencil',
    optional: true,
  },
  {
    id: 'download',
    chapter: 'Models',
    label: 'Download',
    guide: 'I am fetching your models now. Big files take a while, so feel free to grab a coffee.',
    tiger: 'busy',
  },
  {
    id: 'pdf',
    chapter: 'Preferences',
    label: 'PDF text',
    guide: 'How should I read your PDFs? Using their own text is fastest, and I only fall back to OCR when I must.',
    tiger: 'focused-reading',
  },
  {
    id: 'style',
    chapter: 'Preferences',
    label: 'Writing style',
    guide: 'Tell me how you like to sound. Move the sliders and I will adapt my drafts to match.',
    tiger: 'writing-intently',
  },
  {
    id: 'look',
    chapter: 'Preferences',
    label: 'Look',
    guide: 'Pick a look for the app. Sketchbook is bright paper, Night is easy on the eyes after dark.',
    tiger: 'cheerful',
  },
  {
    id: 'tour',
    chapter: 'Tour',
    label: 'Quick tour',
    guide: 'Here is what lives on the left rail. Point at a card and I will show you what each one does.',
    tiger: 'taking-notes',
  },
  {
    id: 'done',
    chapter: 'Done',
    label: 'Done',
    guide: "All set! Here is what we chose together. You can change any of it later in Settings.",
    tiger: 'excited',
  },
]

export const STEP_IDS: StepId[] = STEPS.map((s) => s.id)

export const isStepId = (v: unknown): v is StepId => typeof v === 'string' && (STEP_IDS as string[]).includes(v)

export const stepDef = (id: StepId): StepDef => STEPS.find((s) => s.id === id) ?? STEPS[0]
