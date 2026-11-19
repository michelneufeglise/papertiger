# UX v3: Sketchbook

Pencil-sketch look: cream paper, graphite line work, a little pink blush, and a cartoon tiger mascot. Replaces UX v2 "Tiger / Paper". Source of truth is the code: `src/index.css`, `src/components/ui/*`, `src/lib/tiger.ts`, `src/lib/theme.ts`, `src/components/PaperPanel.tsx`.

## Palette

Tokens live on `:root` / `html.light` (Sketchbook) and `.dark` (Night) in `src/index.css`, and are re-exposed to Tailwind through `@theme inline` (`bg-panel`, `text-fg-muted`, `bg-rose`, ...). The names `--tiger` and `--ember` are legacy; `--tiger` is now the ink primary.

| Token | Sketchbook (light, default) | Night (dark) |
|---|---|---|
| `--bg` paper | `#f3ead6` | `#24211e` |
| `--panel` | `#fbf6ea` | `#2e2a26` |
| `--panel-2` | `#efe4cc` | `#38332e` |
| `--fg` | `#2a2522` | `#efe6d2` |
| `--fg-muted` / `--fg-faint` | ink at 68% / 42% | chalk at 68% / 40% |
| `--line` | ink at 85% | chalk at 80% |
| `--line-soft` | ink at 20% | chalk at 18% |
| `--tiger` (primary) | `#2a2522` | `#efe6d2` |
| `--on-tiger` | `#fbf6ea` | `#24211e` |
| `--rose` blush | `#e9a3a6` | `#e9a3a6` |
| `--mint` success | `#5f8a52` | `#8fbf7f` |
| `--ember` | `#d08a62` | `#d9a27a` |
| `--danger` red pencil | `#b8504a` | `#e07a70` |

Radii: `--r-sm` 10px, `--r-md` 16px, `--r-lg` 22px. There is no orange accent.

Theme logic is in `src/lib/theme.ts`: `applyTheme` sets exactly one of `dark` / `light` on `<html>`, the choice persists in `localStorage` (`papertiger.theme`), and the default is light. Labels: **Sketchbook / Night / Auto**.

## Fonts

Self-hosted via fontsource, imported in `src/main.tsx`:
- Display: Patrick Hand (single weight, never fake-bold; `.font-display` forces 400). Titles, nav labels, buttons.
- Body: Nunito Variable.
- Mono: JetBrains Mono Variable, for meta text.

Lucide icons are drawn at pencil weight (stroke 2.25, round caps and joins).

## Cartoon component language

- `.sketch` (alias `.glass`): `--panel` fill, 2px `--line` border, wobbly radius, hard `3px 4px 0 var(--line)` offset shadow, no blur. `.sketch-alt` mirrors the radius so neighbours do not look stamped.
- `.wobble` / `.wobble-alt`: the wobbly radius alone, for inner pieces.
- `.sketch-btn`: lifts on hover (`translate(-1px,-1px)`, bigger shadow), presses on click (`translate(2px,3px)`, shadow collapsed).
- `.hatch` (alias `.stripes`; `.hatch-animate` scrolls it): diagonal pencil hatching, the signature for "the tiger is working". Wrapped by the `Stripe` component.
- `.doodle-underline`: wavy blush underline under a title.
- `.highlighter`: blush swipe behind text or icons (active nav item).
- `.paper-ground`: opaque cream base with SVG fibre grain and very faint ruled lines. Used on the app root; there is no aurora or native vibrancy.
- `--line` vs `--line-soft`: `--line` is for visible strokes (borders, shadows, grips); `--line-soft` is for quiet dividers and dashed rules.
- Text on the primary fill uses `--on-tiger` (cream on ink in light, ink on chalk in dark). Primary buttons are filled `--tiger`.
- Danger and errors use `--danger` (red pencil); success uses `--mint`; focus and active states use `--rose`.
- Other pieces: `.shimmer` placeholder lines, `.caret-blink`, styled range inputs (blush fill), thin scrollbars.

## Tiger mascot

Code: `src/lib/tiger.ts` (state, cycle, mood) and `src/components/ui/Tiger.tsx`.

**Sprites.** 36 transparent WebP files in `src/assets/tiger/<state>.webp`, cut from `design/tiger-emotions-sheet.jpg` (6x6 sheet). Names, in sheet reading order: idle, listening, thinking, talking, happy, sad, surprised, laughing, shy, sleeping, bored, angry, scared, excited, disgusted, confused, cheerful, frustrated, sick, shocked, anxious, proud, doubtful, lazy, sad-hello, waving-bye, cuddly, thirsty, busy, spooked, nervous, hopeful, chilling, wonder, writing, reading. URLs are collected with `import.meta.glob`.

**Cutter tool.** `design/tools/cut_tiger_sheet.py` is a dev-only asset tool (not part of the build; the shipped app stays Node/TS). It crops each cell excluding the label, removes the paper with an edge-connected flood fill plus soft threshold (white bellies stay white), drops stray neighbour fragments, and writes the WebP files plus a contact sheet for checking by eye. Needs Pillow, numpy, scipy.

**5 s cycle.** `<Tiger cycle />` follows one global ticker (`TIGER_CYCLE_MS = 5000`) that steps through all 36 states, preloads the next sprite, and skips ticks while `document.hidden`. Each change is a short flip (scale and rotate pop, about 250 ms).

**Mood priority.** `useTigerMood()` pins a state while the app is busy; the cycling tiger shows it instead of the cycle. First match wins:
1. a paper section is writing: `writing`
2. last chat message is a streaming assistant reply: `talking`
3. last chat message is from the user (no reply yet): `thinking`
4. a source is rendering or extracting: `reading`
5. a source newly failed (shown for 4 s; errors restored at launch do not count): `sad`
6. otherwise none, so the cycle shows.

**Where each pose is used.**
- Cycling: rail logo (56px), title bar (24px), Settings (64px), paper panel header when not writing (40px).
- Fixed: Chat empty state `hopeful` (140px), Chat typing indicator `thinking` (36px), Draft generating `busy` (48px), paper panel header while writing `writing`, Sources drop zone `reading` on drag-over / `cuddly` when empty / `idle` otherwise (96px), Sources rows `reading` while extracting and `sad` on error (32px), Setup wizard one state per step, Voice screen a state chosen from the retrain status.

**Night sticker.** In dark mode the tiger sits on a cream (`#fbf6ea`) disc with a `--line` border and 6% inset, so the graphite line work stays readable. Detected by watching the `dark` class on `<html>`.

## Paper panel

`src/components/PaperPanel.tsx`, the right-hand live preview of the draft, drawn as a pinned page (cream `.sketch-alt` card, slight tilt, offset shadow, tape strip).
- Default width 480px; resizable from 380px up to 50% of the window; clamped again on window resize.
- Width persists in `localStorage` (`papertiger.paperPanelWidth`); open/collapsed state in `papertiger.paperPanel`. Collapsed is an 11-unit-wide rail with a vertical "Paper" label.
- Resize handle on the left edge: `role="separator"`, 16px hit area, grip bar visible at rest (`--line` at 40%), blush on hover, press and keyboard focus. Drag with the pointer, or focus it and press ArrowLeft / ArrowRight to change the width by 24px (clamped and persisted the same way). Exposes `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Preview shows up to 1800 characters per section; unwritten sections are shimmer lines; the writing section follows the caret.

## Motion and performance

- No `backdrop-filter` anywhere. Surfaces are opaque; this is cheaper on an older MacBook Air.
- Animate `transform` and `opacity` only. Hover and press effects are transforms plus shadow swaps; no layout-affecting animation.
- One global timer for the tiger cycle: started with the first subscriber, cleared with the last, paused while the window is hidden. The sprite snapshot is a primitive index so React state stays stable.
- Reduced motion (`prefers-reduced-motion: reduce`): hatch scrolling, caret blink and shimmer stop, button transitions are removed, and all animation and transition durations collapse to near zero.
- Springs and pop-ins use framer-motion; keep them short (about 250 ms).

## Regenerating the sprites

From the repo root:

```
python3 design/tools/cut_tiger_sheet.py [contact.png]
```

Edit or replace `design/tiger-emotions-sheet.jpg` first if the sheet changes. The script overwrites `src/assets/tiger/*.webp` and writes a contact sheet (default `tiger-contact.png` in the current directory) to review by eye. Requires Pillow, numpy and scipy; the script's shebang points at `/opt/homebrew/bin/python3`, so use that interpreter if `python3` lacks them.
