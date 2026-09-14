# papertiger — Design Brief (v2, "Tiger / Paper")

Audience: researchers and grad students aged 20–30. They live in dark-mode editors,
Arc/Raycast/Linear-style tools, and expect an app that feels fast, opinionated and a
little playful — not a corporate dashboard. Everything runs on-device on an older
MacBook Air, so the UI must be light on GPU work (small blur surfaces only).

## Identity in one line
A tiger made of paper: warm off-white "paper" text on deep ink, one loud tiger-orange
accent, and diagonal tiger stripes that only appear when the app is *working*.

## Tokens (CSS custom properties, defined in `src/index.css`)

Dark = default ("Tiger"). Light = "Paper". Toggle with `.dark` on `<html>`.

| token          | Tiger (dark)                | Paper (light)               | use |
|----------------|-----------------------------|-----------------------------|-----|
| `--bg`         | `#0E0D12`                   | `#F3EEE4`                   | app ground, painted at 84% alpha over native vibrancy |
| `--panel`      | `rgba(255,255,255,0.045)`   | `rgba(255,255,255,0.55)`    | cards, rail, composer |
| `--panel-2`    | `rgba(255,255,255,0.08)`    | `rgba(255,255,255,0.8)`     | hovered / raised panels, inputs |
| `--fg`         | `#F3EEE4`                   | `#14131A`                   | primary text |
| `--fg-muted`   | `rgba(243,238,228,0.58)`    | `rgba(20,19,26,0.6)`        | secondary text |
| `--fg-faint`   | `rgba(243,238,228,0.32)`    | `rgba(20,19,26,0.38)`       | labels, placeholders |
| `--line`       | `rgba(243,238,228,0.10)`    | `rgba(20,19,26,0.10)`       | hairlines, borders |
| `--tiger`      | `#FF6B1A`                   | `#F25A0A`                   | THE accent: primary buttons, active nav, focus rings, user bubbles |
| `--ember`      | `#FFB347`                   | `#FFB347`                   | gradient partner of tiger (tiger→ember), never alone |
| `--mint`       | `#7CF5C6`                   | `#12A97A`                   | success / "on-device" / OCR done |
| `--rose`       | `#FF5C7A`                   | `#E0405E`                   | errors, destructive |

Radii: `--r-sm: 10px`, `--r-md: 16px`, `--r-lg: 22px`, pill `999px`.
Shadows: `--shadow-panel: 0 1px 0 rgba(255,255,255,.06) inset, 0 12px 40px -12px rgba(0,0,0,.6)`.

Tailwind v4: expose these through `@theme` as `--color-bg`, `--color-panel`, `--color-fg`,
`--color-tiger` … so classes like `bg-panel`, `text-fg-muted`, `bg-tiger`, `border-line`,
`rounded-md` work. Add `@custom-variant dark (&:where(.dark, .dark *));` for class-based dark mode.

## Type
Self-hosted via fontsource (already installed):
- `@fontsource-variable/bricolage-grotesque` → `--font-display`. Screen titles, big numbers, wordmark, empty-state headlines. Weight 600–800, tight tracking (`-0.02em`), `font-optical-sizing: auto`.
- `@fontsource-variable/dm-sans` → `--font-sans`. All body/UI text. 14px base, line-height 1.5.
- `@fontsource-variable/jetbrains-mono` → `--font-mono`. Metadata: timestamps, file sizes, word counts, page counts, shortcuts, status labels. Usually 11–12px, uppercase with `0.08em` tracking for labels.

Import the three fontsource `index.css` files at the top of `src/index.css`.

## Surfaces & glass
- Window is transparent with native Sidebar vibrancy (Tauri). The app root paints
  `color-mix(in srgb, var(--bg) 84%, transparent)` so vibrancy bleeds through.
- Atmosphere (in `App.tsx`, fixed, `pointer-events-none`, behind content):
  1. **Aurora**: one 720px radial gradient `var(--tiger)` → transparent, top-right,
     opacity 0.28 (dark) / 0.18 (light), `filter: blur(40px)`, 28s ease-in-out drift
     animation (translate ±40px, scale 1↔1.08). Disabled under `prefers-reduced-motion`.
  2. **Grain**: SVG `feTurbulence` noise as a data-URI background, opacity 0.05, `mix-blend-mode: overlay`.
- `.glass` utility: `background: var(--panel); backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid var(--line); box-shadow: var(--shadow-panel)`. Use it on the rail,
  title bar, composer, modals and cards ONLY — never on full-screen containers (GPU cost).

## Signature: the stripes
`.stripes` = `repeating-linear-gradient(135deg, var(--tiger) 0 6px, transparent 6px 14px)`
with `background-size: 20px 20px` and an animation `stripes-run 0.8s linear infinite`
that shifts `background-position` by 20px. Meaning: **the tiger is working.**
Only used for: OCR extracting bar on a source card, the generation-streaming bar in
Draft, the retraining state in Voice, and the drop zone border while dragging over it.
Under `prefers-reduced-motion` the animation stops but stripes stay.

## App frame
```
┌────────────────────────────────────────────────────────────────┐
│ ● ● ●   Draft                            ● 100% on-device      │  title bar 44px, draggable, glass
├──────┬─────────────────────────────────────────────────────────┤
│  pt  │                                                         │
│      │                                                         │
│ ▣    │              screen content                             │
│ Chat │                                                         │
│      │                                                         │
│ ▢    │                                                         │
│ Srcs │                                                         │
│  …   │                                                         │
└──────┴─────────────────────────────────────────────────────────┘
   rail 72px wide, glass, icon + 10px mono label under it
```
- Title bar: `h-11`, `data-tauri-drag-region`, left padding 88px (macOS traffic lights),
  screen title in display font 15px/700, right: pill `● 100% on-device` (mint dot, mono 11px).
- Rail: 72px, vertical, wordmark `pt` at top in display 800 with the "t" in tiger color,
  nav items = icon (20px) over mono label (10px, uppercase). Active item: a tiger pill
  (`bg-tiger`, ink-colored icon) that slides between items via framer-motion `layoutId="rail-pill"`.
  Hover: `bg-panel-2`. Focus-visible: 2px tiger ring.
- Route transition: opacity + 6px y, 180ms. Keep it subtle.

## Nav labels & routes (paths unchanged)
| path          | label    | icon (lucide)   |
|---------------|----------|-----------------|
| `/`           | Chat     | MessageSquare   |
| `/references` | Sources  | FolderOpen      |
| `/editor`     | Draft    | PenLine         |
| `/style`      | Voice    | AudioWaveform   |
| `/settings`   | Settings | SlidersHorizontal |

## Component API (`src/components/ui`, keep these exports)
- `GlassCard({children, className, variant?: 'default'|'raised', as?})` — `.glass`, `rounded-[var(--r-lg)]`, padding left to caller.
- `GlassButton({variant: 'primary'|'secondary'|'ghost'|'danger', size: 'sm'|'md'|'lg', icon?, children, ...button props})`
  - primary: `bg-tiger text-[#0E0D12]` font-semibold, hover brightens (`filter: brightness(1.08)`), active scale .97. Pill radius.
  - secondary: `bg-panel-2 border border-line text-fg`, hover `bg-panel-2`+brighter.
  - ghost: transparent, `text-fg-muted`, hover `bg-panel-2 text-fg`.
  - danger: `text-rose` ghost until hover → `bg-rose/15`.
  - All: `focus-visible:ring-2 ring-tiger ring-offset-0`, `disabled:opacity-40`.
- `GlassInput`, `GlassTextarea` — `bg-panel-2 border-line rounded-[var(--r-md)] text-fg placeholder:text-fg-faint`, focus: `border-tiger/60` + soft `0 0 0 3px rgba(255,107,26,.18)` ring.
- `Chip({tone: 'neutral'|'tiger'|'mint'|'rose', mono?, children, onRemove?})` — pill, 11px, mono when `mono`.
- `StatusChip({status: 'idle'|'processing'|'success'|'error', children})` — dot + label; `processing` shows a tiny 3-bar `.stripes` swatch instead of the dot.
- `Stripe({className, active?: boolean})` — NEW. A 4px-tall bar that renders `.stripes` (animated while `active`), used for working states.
- `Kbd({children})` — NEW. mono 10px, `bg-panel-2 border-line rounded-sm px-1.5`.
- `Sidebar`/`SidebarItem` → now render the rail described above (keep names).
- `TitleBar({title})` — as above.
- `Modal({isOpen, onClose, title, children, className})` — backdrop `bg-black/40 backdrop-blur-sm`, panel `.glass rounded-[var(--r-lg)]`, spring in, Esc closes, title in display font.

## Screens

### Chat (`/`)
- Empty state (when no messages): display headline "What are we writing today?" (40px/700),
  sub in muted "Tell me the topic, paste notes, or drop a PDF in Sources.", then 3 suggestion
  chips (tiger outline) that fill the composer: "Outline a methods section", "Summarize my sources", "Turn my notes into an abstract".
- Thread: max-width 760px centered. User messages right-aligned, `bg-tiger/15 border border-tiger/30`
  rounded-[var(--r-lg)] with the bottom-right corner `rounded-br-sm`. Assistant messages have
  NO card: a 24px `pt` glyph avatar (display font, bg-panel-2, rounded) on the left and plain
  text. Timestamps in mono 11px `text-fg-faint`, shown on hover only (group-hover opacity).
- Typing indicator: three tiger dots.
- Composer: sticky bottom, `.glass` pill-ish container (`rounded-[var(--r-lg)]`), textarea auto-grows to 6 lines,
  left: paperclip ghost button, right: primary send button (icon only, round 36px). Under it a mono hint:
  `<Kbd>↵</Kbd> send  <Kbd>⇧↵</Kbd> newline` in `text-fg-faint`.
- Keep existing mock data and canned replies.

### Sources (`/references`)
- Header: display "Sources" 28px + muted "Everything the paper will be built on. Text is extracted on-device."
- Drop zone: full-width, dashed `border-line` 2px, `rounded-[var(--r-lg)]`, py-10. Center: an
  upload icon in a tiger-tinted circle, "Drop PDFs, DOCX or images", mono sub "or" + secondary
  button "Choose files". On drag-over: border becomes solid tiger and a `Stripe active` bar
  appears at the top edge of the zone.
- List (not grid): each source is a row card (`GlassCard`, p-4, flex): a 40px type badge
  (mono 10px: PDF / DOCX / IMG, on `bg-panel-2`), name (14px/600, truncate), mono meta line
  `42 pages · 2.4 MB · 7d ago`, then a `StatusChip`, then ghost icon buttons Preview / Remove
  (remove is `danger`). While `processing`, a `Stripe active` runs along the bottom edge of the card.
- Count label above list in mono uppercase: `3 SOURCES`.
- Preview modal: mono meta grid (Type / Size / Pages / OCR) + "Extracted text" block in
  `bg-panel-2 rounded-[var(--r-md)] p-4` with `max-h-64 overflow-auto`.
- Keep mock data + simulated OCR completion.

### Draft (`/editor`)
- Top bar (not glass; just border-b line): editable title as a display-font input
  (22px/700, transparent bg, no border, tiger caret), right: word count in mono
  (`1,240 words · 5 sections`), primary "Generate" (Zap) and secondary "Export".
- Body: left outline rail 200px: mono uppercase label `OUTLINE`, then section buttons showing
  title + mono word count on the right; active = `bg-panel-2` with a 2px tiger left bar.
- Editor surface: `GlassCard` raised, p-8, section title in display 20px/700, textarea
  16px/1.7 line-height DM Sans, no visible border (bg transparent), min-h-full.
- Generation: when streaming, a `Stripe active` bar at the top of the editor card and the
  generated text appended live with a blinking tiger caret `▍`. Mono status under title: `writing…`.
- Keep the mock token stream and export console.log.

### Voice (`/style`)  (was "Style")
- Header: display "Your voice" + muted "How you write, learned from your edits. Grammar is always corrected."
- Metrics: 5 cards in a responsive grid (2 cols ≥ md, 3 ≥ xl). Big number in display 32px/700
  with unit in mono muted next to it, name 13px/600, description 12px muted, thin bar under
  with tiger→ember gradient fill.
- Before/after: two `GlassCard`s side by side; chips "Your draft" (neutral) and "Tuned" (mint);
  text 14px, not italic; a small mono diff hint `+ grammar  = voice` under the tuned one.
- Tuning: sliders styled: track 4px `bg-panel-2`, filled part tiger, round thumb 18px white
  with tiger border (style `input[type=range]` in index.css with `-webkit-slider-thumb`).
  Value badge mono `7 / 10` in tiger chip. Live preview block under.
- Retrain card: `GlassCard` with a tiger→ember 1px gradient border (use background-clip
  trick or an outer gradient wrapper), primary button "Learn from my edits"; while
  retraining show `Stripe active` and mono `learning…`.

### Settings (`/settings`)
- Header: display "Settings".
- Sections as `GlassCard`s with a mono uppercase eyebrow (`APPEARANCE`, `MODELS`, `MEMORY`, `ABOUT`).
- Appearance: segmented control with three options **Paper** (Sun) / **Tiger** (Moon) / **Auto** (Monitor)
  mapping to light/dark/system; the selected segment is a sliding tiger pill (`layoutId="theme-pill"`).
  Keep the existing behaviour that toggles `.dark` on `<html>`. Default theme: Auto.
- Models: two rows: "OCR · unlimited-OCR" and "Writer · lightweight local model", each with a
  mint `Chip mono` "ON-DEVICE" (not "Cloud" — everything is local) and a muted one-liner.
- Memory: DB path input + two stat tiles (mono numbers): `24.5 MB`, `1,247 memories`.
- About: rows Application / Version / Build in a definition-list style with hairlines,
  secondary button "Check for updates".

## Motion rules
- Durations 150–250ms, spring for pills/buttons (`stiffness 500, damping 30`).
- Page enter: opacity 0→1, y 6→0. Lists: stagger 30ms max.
- Respect `prefers-reduced-motion`: framer `MotionConfig reducedMotion="user"` at the root.

## Copy rules
Sentence case. Buttons say what happens: "Generate", "Export", "Choose files", "Learn from my edits",
"Check for updates". No "Submit". Empty states invite action. Never say "Cloud".

## Performance guardrails (old MacBook Air)
- `backdrop-filter` only on rail, title bar, composer, cards, modal. Never on the page.
- One aurora blob, blurred once via `filter` on a small element; no `filter` on large containers.
- No infinite animations except the stripes while working, the typing dots, and the caret.
