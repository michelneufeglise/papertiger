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

**Sprites.** 48 transparent WebP files in `src/assets/tiger/<state>.webp`, collected with `import.meta.glob`. `TIGER_STATES` lists them in this order:
- **36 emotions**, cut from `design/tiger-emotions-sheet.jpg` (6x6), in sheet reading order: idle, listening, thinking, talking, happy, sad, surprised, laughing, shy, sleeping, bored, angry, scared, excited, disgusted, confused, cheerful, frustrated, sick, shocked, anxious, proud, doubtful, lazy, sad-hello, waving-bye, cuddly, thirsty, busy, spooked, nervous, hopeful, chilling, wonder, writing, reading.
- **12 reading/writing poses**, cut from `design/tiger-reading-writing-sheet.jpg` (3x4), with their props kept (books, notepad, pencils, paper, crumbs, zzz, stars): opening-book, focused-reading, turning-page, amazed-reading, sleepy-reading, taking-notes, picking-up-pencil, thinking-before-writing, writing-intently, scribbling-fast, erasing-mistake, finished-page. Preview: `docs/ux-v3-status-poses.png`.

If a sprite file is missing, `tigerSrc` falls back to the closest emotion, then to idle.

**Cutter tool.** `design/tools/cut_tiger_sheet.py` is a dev-only asset tool. It is not part of the build; the shipped app stays Node/TS.
- It takes a sheet config, `--sheet emotions` (the default) or `--sheet reading-writing`, which sets the grid, names, label cut and speck tuning.
- It crops each cell excluding the label and removes the paper with an edge-connected flood fill plus a soft threshold, so white bellies stay white.
- It drops stray neighbour fragments; the reading-writing config loosens this rule so props survive.
- It writes the WebP files plus a contact sheet for checking by eye.
- Needs Pillow, numpy and scipy.

**5 s cycle.** `<Tiger cycle />` follows one global ticker (`TIGER_CYCLE_MS = 5000`) that steps through all 48 states, preloads the next sprite, and skips ticks while `document.hidden`. Each change is a short flip (scale and rotate pop, about 250 ms).

**Status engine.** `useTigerStatusEngine()` in `src/lib/tiger.ts` is mounted **once** (`TigerEngine` in `App.tsx`, inside the router, so it also runs on `/setup`).
- It watches the chat, paper and sources stores and writes one `TigerState | null` into a module store.
- Every `<Tiger cycle>` reads that store with `useTigerStatus() ?? useTigerCycle()`. `useTigerMood` is a deprecated alias.
- A 500 ms interval runs only while a section is writing or a source is extracting, so time-based poses (pencil, sleepy, writing speed) can change without a store update. When the app is idle there is no timer.

| Activity | Pose |
|---|---|
| Section writing, no text yet, first 2 s | `picking-up-pencil` |
| Section writing, still no text after 2 s (model loading or prefilling) | `thinking-before-writing` |
| Text streaming under 40 chars/s (2 s sliding window) | `writing-intently` |
| Text streaming at 40 chars/s or more | `scribbling-fast` |
| Section went writing → done (flash 4 s; not after Stop or an error) | `finished-page` |
| Writer failed (flash 4 s, from `writer.ts` `catch`; not on Stop) | `erasing-mistake` |
| Chat: assistant reply streaming | `talking` |
| Chat: a user message sent this session with no reply yet | `thinking` |
| A source is rendering (PDF pages prepared) | `opening-book` |
| A source is extracting | `focused-reading` |
| Same source and page extracting for 45 s or more | `sleepy-reading` |
| OCR page number advanced (flash 1.5 s) | `turning-page` |
| A source finished (flash 4 s) | `amazed-reading` |
| A source failed (flash 4 s) | `sad` |
| Humanize running, no draft token yet for the block | `picking-up-pencil` |
| Humanize running, drafting | `erasing-mistake` |
| Humanize finished, nothing flagged (flash 4 s) | `finished-page` |
| Humanize finished, some blocks flagged (flash 4 s) | `sad` |

**Priority.** First match wins:
1. active writing
2. humanize running (`picking-up-pencil` until the block's first token, then `erasing-mistake`)
3. chat talking
4. chat thinking
5. active reading (a `turning-page` flash beats focused/sleepy reading, but not opening-book)
6. flashes
7. null, so the cycle shows.

**Flashes.** `flashTiger(state, ms)` can be called from anywhere.
- Flash priority: errors (`erasing-mistake`, `sad`) are 3, completions (`finished-page`, `amazed-reading`) are 2, and `turning-page` is 1.
- A new flash replaces the current one unless the running flash has strictly higher priority.
- `suppressFinishFlash()` is called by the writer on Stop. Together with the error flash, it keeps finished-page from showing after an abort or a failure.

**Hydration.** Sources and chat messages that already exist when the engine first runs never trigger anything: a restored error doesn't show sad, and the seeded chat thread ending in a user message doesn't pin `thinking`.

**Where each pose is used.**
- Engine-driven (`<Tiger cycle>`): header left corner (56px), Settings (64px), paper panel header (40px), Draft generating (48px), Humanize result card while running (48px).
- Sources rows (32px): `tigerForSource(source)`, which shows opening-book, focused-reading or sleepy-reading, sad on error, and nothing when done. The rows re-render every second only while something is extracting.
- Sources drop zone (96px): `reading` on drag-over, `cuddly` with no sources, `taking-notes` when sources exist and none is running, `idle` while one runs.
- Fixed: Chat empty state `hopeful` (140px), Chat typing indicator `thinking` (36px), Setup wizard one state per step, Humanize empty state `cuddly` (96px).

**Night sticker.** In dark mode the tiger sits on a cream (`#fbf6ea`) disc with a `--line` border and 6% inset, so the graphite line work stays readable. Detected by watching the `dark` class on `<html>`.

## Frames and the desk

The window is a rounded **desk**, and every column floats on it as its own card with a pencil-drawn outline.
- **Desk:**
  - The root in `App.tsx` is `rounded-[22px] overflow-hidden` in `--desk` (light `#e9dcc0`, Night `#1c1a17`) with faint grain (`.desk-ground`).
  - It has 12px padding and 12px gaps, and carries `data-tauri-drag-region`, so any gap drags the window.
  - A `SketchFrame` outline with no fill and no shadow runs around the whole window.
  - In Tauri, `main.tsx` adds `html.tauri`, which makes html, body and #root transparent so the rounded corners show the desktop. In the browser, the area outside the rounded desk is `--desk`.
- **Cards:** header (seed 1), rail (seed 2), main column (seed 3, with the ruled `.paper-ground` inside it), paper panel (seed 4), and the window outline (seed 5). The setup wizard sits in one large card below the header.
- **`SketchFrame`** (`src/components/ui/SketchFrame.tsx`):
  - Props: `seed`, `radius=18`, `shadow`, `fill`, `strokeOpacity`, `overflow="visible"|"hidden"`, `innerClassName`, `as`, and `data-*` passthrough.
  - It draws an SVG behind its children with four layers: an offset shadow (3, 4) in `--line` at 18%, a `--panel` fill, a 2.2px main stroke in `--line`, and a 1px second pencil pass at 45% from another seed.
  - With `overflow="hidden"`, an inner layer does the clipping, so the strokes and the shadow themselves are never clipped.
  - Paths come from `src/lib/sketchPath.ts` (`sketchRoundedRect`, `sketchSecondPass`). It is a seeded, pure generator: smooth noise of ±1.2px every ~36px, corner radii varying ±15%, and a small overshoot so the line doesn't close perfectly.
  - A `ResizeObserver` regenerates the paths only when the integer size changes.
  - It uses no SVG filters and no animation.
- **Inner dividers:** full-width column dividers are dashed `--line-soft`, never a solid ink rule.
- **Small elements:** cards and buttons still use the CSS `.sketch` / `.wobble` borders.

## Humanize

`src/screens/HumanizeScreen.tsx`, route `/humanize`, rail entry between Draft and Settings (`Wand2`). The paper panel is hidden here.
- **Top to bottom:** intro, document picker, Tone grid (4), Strength grid (3, with hints), Manual review checkbox, Humanize / Cancel button, progress, preview grid, full result card.
- **Collections:** the picker is a multi-select. Each done source is a sketch chip with a hand-drawn check box and a mono word count. "Select all · Clear" links sit beside the label, and a mono line shows "3 selected · 1,240 words". Selection is locked while a batch runs. The button reads "Humanize" for one document and "Humanize N documents" for several; the documents run one after another.
- **Add zone:** above the chips, a dashed `.wobble` drop zone ("Drop documents here: Word, Pages, PDF, RTF, ODT, EPUB, text...") with an **Add documents** secondary button. Dragging over it fills it blush and shows the hatch `Stripe` along the top edge, as on Sources; the tiger (idle `cuddly`, `reading` on drag-over) only shows while there are no documents. Files go through `src/lib/addFiles.ts`, so they also appear on Sources. A new file shows at once as a dashed, non-selectable chip with a mono status ("reading...", "OCR 2/5"), and becomes a normal chip, auto-selected once, when it is done. Failed files are listed in `--danger` under the zone; unsupported types are skipped with a short note.
- **Input formats** (`src/lib/extract/`): docx, doc, pages, rtf, odt, txt, md/markdown, html/htm/xhtml, epub, webarchive, wordml, plus PDF and images (png, jpg, webp, gif, tiff, bmp, heic) through OCR. Text-native formats are converted to light markdown (`#` headings, blank-line paragraphs, `- ` items, `| a | b |` table rows) and never wait for the OCR model. `doc`, `webarchive` and `wordml` need macOS `textutil`, so they only open in the app (the browser preview says "Open this file in the app"). A Pages file is read from its `Index/Document.iwa` text; if that fails, the first-page preview image is OCR'd with a note.
- **Download** (`src/components/humanize/DownloadMenu.tsx`, writers in `src/lib/humanize/export/`): a split button on each finished card (sm) and the full result (md). The main part saves in the last-used format (`papertiger.humanizeExport`); the chevron lists docx, pdf, doc (app only, via `textutil`), rtf, odt, html, md and txt, with a muted "Pages opens .docx" hint. All formats are built from the reviewed outputs; the button shows "Saved" for 2 s.
- **Manual review:** a sketch checkbox (real hidden input, wobbly box, hand-drawn tick, blush focus ring) labelled "Manual review — check every change before using it". When on, finished cards get a **Review** button.
- **Progress:** pencil-hatch `Stripe`, mono "Document k of N · block i/M · elapsed · tok/s" (or "preparing…"), and a thin bar (shimmer while preparing).
- **Preview grid:** `grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4`, one page-like card per selected source (`.sketch-alt`, tilt of -0.6 / +0.6 degrees alternating, a blush tape strip), plus older jobs that are not selected, dimmed.
  - Header: title, word count and a status badge (Queued, Humanizing i/M with a hatch strip, Done, "n kept" when the guard held blocks back, Cancelled, Error).
  - Body: about 8 lines with a bottom fade. It shows the original before a run, the live draft while running, and the effective result when done ("n of M blocks changed").
  - Actions once finished: Copy, .docx and, with Manual review on, Review ("n reviewed" once decisions exist).
  - Clicking the card body makes it active (blush outline). The active card is the running one, else the first done one.
- **Result:** a `GlassCard` for the active document, rendered from `toView` with the effective outputs (rewrites with review decisions applied). Rewritten blocks get a blush left border, the block being written shows its live draft in muted italics. Copy (markdown), Download .docx and Clear appear once it has ended. Blocks the quality check rejected are listed in a note below.
- **Review portal** (`src/components/humanize/ReviewPortal.tsx`): a `createPortal` sheet on the Modal backdrop (`w-[92vw] h-[88vh] max-w-[1200px]`, `.sketch`), with `role="dialog"`, `aria-modal`, Esc and X to close, focus moved to the sheet and returned to the Review button. Reduced motion drops the spring.
  - Header: "Review · title", counts "n changed · n reverted · n edited · n kept by the guard", Keep all, Revert all and a "Show unchanged blocks" toggle (off; adds dimmed read-only context such as headings).
  - Body: sticky "Original | Humanized" column heads, then one row per changed or guard-flagged block, in document order.
  - Diff colours: deleted words on the left are struck through in `--danger` (2px line, on a faint red tint); inserted words on the right sit on a blush `--rose` highlight.
  - Row footer: a decision chip (Rewrite kept, Reverted, Edited, Kept by guard) and Keep, Revert, Edit. Edit swaps the right column for an auto-growing textarea with Save and Cancel.
  - Flagged rows list the guard issues in muted mono; a refused rewrite is shown diffed against the original under "Rejected rewrite", with **Use rewrite anyway**.
  - Decisions apply live, and the portal works while other documents are still running.
- Without a writer model the run button is replaced by a note linking to `/setup?step=writer`.

## Header

`src/components/ui/TitleBar.tsx` is 72px tall: a paper background with a 2px ink bottom stroke, and the whole bar is a Tauri drag region.
- **Left to right:**
  1. the cycling `<Tiger cycle size={56}/>` at a 16px inset (`LEFT_INSET_PX`);
  2. the brush-ink **"Paper Tiger" wordmark**, about 40px tall;
  3. a hand-drawn slash;
  4. the page name in `font-display` at 18px, muted.
- **Right side:** the "100% on-device" pill.
- **Dragging:** the tiger, wordmark, slash and title are `pointer-events-none`, so dragging over them still moves the window.
- **Traffic lights:** the window has `decorations: false`, so no macOS traffic lights are expected in the corner. If they ever appear, raise `LEFT_INSET_PX` to about 80.
- **Wordmark:**
  - It comes from `design/title_paper_tiger.jpeg` through `design/tools/make_wordmark.py`, which flattens the paper, turns ink darkness into alpha, trims, and saves at 96px tall.
  - The output is `src/assets/wordmark-paper-tiger.png` (324×96, `WORDMARK_RATIO` 3.375; the word gap is closed so it reads "PaperTiger").
  - It renders as a CSS `mask-image` filled with `var(--fg)`, so it is graphite on Sketchbook and chalk on Night.
  - To regenerate it, run `/opt/homebrew/bin/python3 design/tools/make_wordmark.py`.
- **Rail:** the rail no longer carries a logo.

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
python3 design/tools/cut_tiger_sheet.py [--sheet emotions|reading-writing] [contact.png]
```

Edit or replace `design/tiger-emotions-sheet.jpg` or `design/tiger-reading-writing-sheet.jpg` first if a sheet changes. The script overwrites that sheet's sprites in `src/assets/tiger/` and writes a contact sheet (default `tiger-contact.png` in the current directory) to review by eye. Requires Pillow, numpy and scipy; the script's shebang points at `/opt/homebrew/bin/python3`, so use that interpreter if `python3` lacks them.
