# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**papertiger** — a local macOS application for generating scientific papers based on research and publications. Targets older hardware (e.g. an older MacBook Air) and runs fully local.

### Product spec
- **Target:** macOS app that runs well on an older MacBook Air. Ships as a native `.app`, easy to install.
- **OCR:** Baidu Unlimited-OCR (DeepSeek-OCR derivative, 2.9B LM + 0.4B vision projector, 32K context, MIT). Quant chosen at first run by hardware: `q8_0` on Apple Silicon with ≥16 GB RAM, `Q4_K_M` on 8 GB machines and on Intel Macs. Sources: Ollama `frob/unlimited-ocr:q8_0` (4.0 GB), GGUF `DevQuasar/baidu.Unlimited-OCR-GGUF` (Q4_K_M 1.95 GB + mmproj f16 825 MB).
- **Writer:** lightweight local LLM writes papers from uploaded content plus context the user adds.
- **Style learning loop:** the writer LLM adopts the user's writing style over time, but always with correct grammar.
- **Chat:** the user gives intent and context conversationally.
- **Uploads:** images, PDFs and DOCX reference documents the paper is based on.
- **Memory:** lightweight local DB (SQLite) so the LLM remembers across sessions.
- **Dependencies:** Tailwind, TypeScript and Node.js only. No Python dependency chain.
- **UX (build this first):** awesome, glassmorphic, responsive, cool, Apple-style.

### Architecture decisions
- **App shell:** Tauri 2. Rust is a build-time toolchain only; the shipped app is tiny with a low runtime footprint (best fit for old hardware) and gives native macOS window vibrancy for true glassmorphism.
- **Frontend:** Vite + TypeScript + React + Tailwind. React bundles to static assets (no extra end-user runtime install).
- **OCR runtime (later phase):** bundle `llama-server` from llama.cpp releases as a Tauri sidecar (macOS arm64 + x64 builds are published; Metal on Apple Silicon, CPU on Intel) and run Unlimited-OCR with `--mmproj`. node-llama-cpp cannot take image input yet (withcatai/node-llama-cpp#88 still open), so it is not an option for OCR. During development, talk to a locally running Ollama instead (`http://localhost:11434`).
- **Writer LLM runtime (later phase):** node-llama-cpp or the same llama-server sidecar — no Python.
- **DB (later phase):** SQLite (e.g. tauri-plugin-sql / better-sqlite3).

## Workflow (required)

Every task in this project MUST follow a two-phase workflow:

### 1. Planning phase — use **Opus**
- Model: Opus (`claude-opus-5`)
- Enter plan mode and produce a step-by-step implementation plan.
- Identify affected files, architectural trade-offs, and open questions.
- Do NOT write or edit code during this phase.
- Get the plan approved before proceeding.

### 2. Implementation phase — use **Sonnet**
- Model: Sonnet (`claude-sonnet-5`)
- Execute the approved plan exactly.
- Delegate the actual code changes to a Sonnet agent, e.g.:
  `Agent(subagent_type: "claude", model: "sonnet", prompt: "<approved plan step>")`
- Keep changes scoped to what the plan specified.

**Rule of thumb:** Always plan first (Opus), then implement (Sonnet). Never skip
straight to implementation.

## Progress Log

Keep this section up to date. After completing work, append a dated entry
describing what was planned and what was implemented.

### 2026-09-15
- Repository initialized (`Initial commit`, `e7d9131`).
- Created `CLAUDE.md` defining the Opus-plan / Haiku-implement workflow and this
  progress log.
- Project state: only `README.md` exists; the application has not been scaffolded yet.

### 2026-09-15 — Requirements & Phase 1 plan (Opus)
- Captured full product spec (OCR, local writer LLM, style-learning loop, chat, uploads, SQLite memory, glass UX).
- Decisions locked: **Tauri 2** shell (over Electron/local-web) for low footprint + native vibrancy; **React + Vite + TS + Tailwind** frontend; **start with UX** as a clickable prototype using mock data (no OCR/LLM/DB wired yet).
- Planned Phase 1 (glassmorphic clickable prototype): scaffold → native glass window → design tokens → glass component library → app frame + routing → 5 screens (Chat, References/Upload, Paper Editor, Style Learning, Settings) with mock data → polish → verify via `tauri dev`.
- Status: plan awaiting approval before Haiku implementation begins.

### 2026-09-15 — Phase 1 implemented (Haiku)
- Toolchain verified present: Node 22, npm 10.9, cargo/rustc 1.94, Xcode CLT.
- **Pass 1 (Haiku):** scaffolded Tauri 2 + Vite + React + TS + Tailwind in place. Native macOS vibrancy via `window-vibrancy` (Sidebar material), transparent window + `decorations:false`, custom draggable `TitleBar`, left `Sidebar` nav, `react-router-dom` routing with framer-motion transitions. Glass design system in `src/components/ui/`: GlassCard, GlassButton, GlassInput, GlassTextarea, Chip, StatusChip, Sidebar/SidebarItem, TitleBar, Modal. Libs: framer-motion, lucide-react, clsx. `npm run build` + `cargo check` both pass.
  - Deviation: Tailwind v4 (`@tailwindcss/postcss`) used instead of requested v3; builds cleanly, kept.
- **Pass 2 (Haiku):** all 5 screens built with maximal polish + mock data (`src/mock/`):
  - Chat: message thread, typing indicator, auto-grow composer, Enter-to-send, canned replies.
  - References: animated drag-drop, file cards with cycling OCR StatusChip (processing→success), extracted-text preview Modal.
  - Editor: two-pane outline + editable section, "Generate" mock token-stream, word count, export (mock).
  - Style: learned-style metric cards, before/after grammar sample, tuning sliders w/ live preview, mock retrain.
  - Settings: functional Light/Dark/System theme toggle (toggles `dark` on <html>), model placeholders (unlimited-OCR, lightweight local LLM), SQLite/memory placeholders, About.
- Verified independently: `npm run build` passes (2299 modules, ~138KB gzip JS), zero TS errors.
- Not yet done (future phases): real OCR (`unlimited-OCR`), local writer LLM (node-llama-cpp), SQLite persistence, style-learning loop, real file IO, `.app`/`.dmg` packaging, launching the GUI (`npm run tauri dev`) for visual QA.

### 2026-09-15 — Workflow change
- Implementation model switched from Haiku to **Sonnet** (`claude-sonnet-5`) at the user's request. Planning stays on Opus.
- Product spec section rewritten to the user's own wording (older MacBook Air target, Tailwind/TypeScript/Node only, SQLite memory, glass UX first).

### 2026-09-15 — UX v2 "Tiger / Paper" plan (Opus)
- Goal: replace the generic pastel-glass look with a distinctive identity for a 20–30 audience.
- Direction: deep-ink ground with warm "paper" text, one tiger-orange accent, mint for on-device/success; display type Bricolage Grotesque, body DM Sans, mono JetBrains Mono (self-hosted via fontsource, installed). Signature element: animated diagonal tiger stripes that appear only while the app is working (OCR, generation, retrain, drag-over).
- Frame: 44px draggable glass title bar with a "100% on-device" pill; 72px icon rail with a sliding tiger pill; nav relabelled Chat / Sources / Draft / Voice / Settings (routes unchanged).
- Full spec (tokens, components, per-screen layouts, motion + performance rules): `docs/DESIGN.md`.
- Implementation split (Sonnet): pass 1 foundation (`src/index.css`, `src/components/ui/*`, `App.tsx`), pass 2 five screens in parallel, then build + visual QA.

### 2026-09-15 — UX v2 "Tiger / Paper" implemented (Sonnet)
- Foundation: `src/index.css` rewritten (Tiger/Paper tokens on `:root`/`.dark`/`html.light`, `@theme inline`, `.glass`, `.stripes`, aurora, range-slider and scrollbar styling, reduced-motion); `tailwind.config.ts` removed (v4 is CSS-configured); fonts self-hosted via fontsource and imported in `src/main.tsx`; `src/components/ui/*` rebuilt to the DESIGN.md API plus new `Stripe` and `Kbd`; `App.tsx` now has the 44px title bar with the "100% on-device" pill, 72px rail with sliding tiger pill, aurora + grain atmosphere.
- Screens: Chat (empty state + suggestion chips, tiger bubbles, `pt` avatar, glass composer, inline **bold** rendering), Sources (drop zone with stripe on drag-over, row list with mono meta, stripe while extracting), Draft (display-font title, outline with sliding bar, stripe + caret while writing), Voice (big-number metrics, before/after, tiger sliders, gradient-border retrain card), Settings (Paper/Tiger/Auto segmented control persisted in `localStorage`, on-device model chips, memory stats).
- Theme logic lives in `src/lib/theme.ts` (`applyTheme`, `useTheme`), applied before first render.
- `vite.config.ts` honours `PORT` (falls back to Tauri's 1420).
- Verified: `npm run build` and `npm run lint` clean; all screens checked in the browser in both themes; screenshots in `docs/ux-v2-*.png`.
- Not done: launching inside Tauri (`npm run tauri dev`) to confirm native vibrancy under the new 84% ink ground; OCR/LLM/DB remain mocked.

### 2026-09-15 — Tauri dev launch fixes
- `src-tauri/tauri.conf.json`: `titleBarStyle` must be `"Overlay"` (capitalised enum) — `"overlay"` failed schema validation and blocked `tauri dev`.
- Added `app.macOSPrivateApi: true`; without it Tauri warns the transparent window is not honoured, so native vibrancy never shows. Note: private API use rules out Mac App Store distribution (direct `.dmg` distribution is unaffected).
- Config validated against the bundled `config.schema.json` (0 errors); `npm run tauri dev` compiles (`Finished dev profile`) and launches `target/debug/app` without warnings.

### 2026-09-15 — OCR model decision (Opus)
- Benchmarked `frob/unlimited-ocr:q8_0` on this M1 Max via Ollama 0.32 with a rendered A4 text page (1236×1600): 906 prompt tokens, 396 output tokens, 6.3 s cold at 8K context (prefill ~250 tok/s, decode ~200 tok/s). Output is layout-aware (header/title/text/table blocks with bounding boxes, tables as HTML). Resident memory: 5.0 GB at `num_ctx` 8192, 6.6 GB at 32768.
- Consequence for an older MacBook Air: 8 GB models cannot hold the q8 footprint next to macOS + the app → use `Q4_K_M` (~3.3 GB resident at 8K context). 16 GB Apple Silicon → `q8_0` is fine. Intel Airs run CPU-only (no Metal), expect minutes per page; Ollama on macOS requires macOS 14+.
- Runtime: llama-server sidecar (no Python, no user-installed deps) chosen over requiring Ollama; node-llama-cpp ruled out for OCR (no image input). Always cap OCR context at 8192 and process one page at a time.
- Q4_K_M verified on the same page (same M1 Max, Ollama, `num_ctx` 8192): `ollama pull hf.co/DevQuasar/baidu.Unlimited-OCR-GGUF:Q4_K_M` fetches the mmproj automatically (2.0 GB + 825 MB, model reports `vision`). Cold 6.2 s (load 1.3 s, prefill ~300 tok/s, decode ~220 tok/s), warm 1.8 s. Resident memory 3.8 GB vs 5.0 GB for q8_0. Extracted text is character-identical to q8; only block labels differ (title/header, table header row emitted as text). Q4_K_M is the default for 8 GB and Intel machines.
- Both quants emit a short junk preamble before the first block (`v`, `s`, `v: T1`); the OCR parser must discard everything before the first `<label> [x, y, x, y]` line.
- Not yet verified: real timings on an Intel Air.

### 2026-09-15 — Phase 2 plan: real OCR, hardware check, first-run wizard (Opus)
- Contract in `docs/PHASE2-OCR.md`: Rust `hardware_info` / `read_file_base64` commands, `src/lib/{hardware,models,settings,ollama,sources}.ts`, wizard at `/setup` (welcome → your Mac → model choice with recommended Q4/Q8 card → download with progress → done), Sources screen wired to Ollama with pdf.js page rendering, mammoth for DOCX, native dialog + drag-drop.
- Recommendation rule: Apple Silicon with ≥16 GB → q8_0, otherwise Q4_K_M. OCR context capped at 8192, one page at a time, junk preamble discarded by the parser.
- Sonnet split: pass 1 plumbing (Rust + lib modules + deps), pass 2 wizard/App/Settings and Sources screen in parallel.

### 2026-09-15 — Phase 2 implemented (Sonnet) + paper panel
- Rust: `hardware_info`, `read_file_base64`, `file_size` commands; `tauri-plugin-dialog` registered (`dialog:default` capability).
- Libs: `src/lib/{tauri,hardware,models,settings,ollama,sources,setup,paper}.ts`. Settings and paper stores use `useSyncExternalStore` with cached snapshots (an unstable snapshot caused an infinite render loop — keep snapshots referentially stable).
- Wizard `/setup`: welcome → your Mac (chip, memory, macOS, cores, Ollama status with re-check) → model choice (recommended Q4/Q8 card, reason line) → download (skips when the model is already pulled, otherwise streams `/api/pull` progress) → done. App redirects to `/setup` until `setupDone`.
- Sources: native file dialog + native drag-drop (HTML5 fallback in the browser), pdf.js page rendering, mammoth for DOCX, sequential OCR queue through Ollama with per-page progress, preview modal with copy. Verified end to end in the browser with `docs/sample-page.pdf` (real Ollama, q4).
- Paper panel: right-hand live preview of the draft on Chat/Sources/Voice, shimmer placeholders for unwritten sections, streaming with caret + tiger bar; Draft editor and panel share `src/lib/paper.ts`. Chat messages containing write/draft/abstract trigger a mock section generation.
- Screenshots: `docs/ux-v2-wizard-*.png`, `docs/ux-v2-sources-panel.png`, `docs/ux-v2-sources-extracting.png`, `docs/ux-v2-chat-paper-writing.png`.
- Not yet done: exercising the Tauri-only paths (native dialog, native drag-drop, `hardware_info`) by hand inside the `.app` — the code paths compile and the browser fallbacks are verified; the writer LLM is still mocked.

### 2026-09-15 — Phase 3 plan: writer LLM via Ollama, optional writer step (Opus)
- Contract in `docs/PHASE3-WRITER.md`. Writer catalog: Qwen 3 (4B/8B), Gemma 3 (4B/12B), DeepSeek-R1 (1.5B/8B), each Q4_K_M and Q8_0, exact Ollama tags verified on ollama.com. Fit rule against the hardware check: resident ≤ RAM − 3 GB fits, ≤ RAM − 1.5 GB tight, else not offered; Intel gets a CPU-speed note. Recommendation = best Qwen that fits (Intel → Qwen3 4B Q4).
- Wizard gains an optional WRITER step (skippable) and a multi-model download list; Settings can reopen the wizard at that step.
- Sources move to a shared store (survive navigation, readable by the writer; OCR model unloaded after the queue drains). Real streaming generation through `/api/chat` feeds the paper store (panel + editor); chat replies come from the writer when configured, canned otherwise.

### 2026-09-15 — Phase 3 implemented (Sonnet): writer LLM, optional writer step
- Catalog + fit in `src/lib/models.ts` / `hardware.ts` (12 writer variants, `writerFit`, `recommendWriter`). Wizard has the WRITER step (family cards, Q4/Q8 pills with fits/tight/no states, recommended dot, Skip) and a multi-row DOWNLOAD list; `/setup?step=writer` deep link from Settings.
- Runtime: `src/lib/ollama.ts` `chatStream` (NDJSON, `think:false` for hybrid models, retry without it), `stripThinking`, `unloadModel`; `src/lib/writer.ts` builds the section prompt (title, other sections, chat intent, ≤9000 chars of source excerpts) and streams into the paper store; `src/lib/chat.ts` is the chat store (real replies when a writer is set, canned otherwise). Draft requests in chat get a fixed one-line reply and go straight to the writer so only one generation runs at a time.
- `src/lib/sourcesStore.ts` owns sources + the OCR queue (survives navigation; unloads the OCR model when the queue drains).
- Verified in the browser against local Ollama with `qwen3:4b-instruct-2507-q4_K_M`: streamed chat reply, a real Results section streamed into the panel, Stop keeps partial text. Screenshots `docs/ux-v2-wizard-writer.png`, `docs/ux-v2-chat-real-writer.png`.
- Not done: Voice tunings are not yet fed into the writer prompt; sources are not persisted across restarts; Gemma/DeepSeek variants were not pulled or exercised here (tags verified on ollama.com only).

### 2026-09-15 — Voice tunings in the writer prompt, persisted sources (Sonnet)
- `src/lib/voice.ts`: persisted tunings store (formality / conciseness / technicality, 1–10) with `describeVoice` mapping each value to one instruction line; the Voice screen sliders write to it. `writer.ts` adds a `Style:` block to the section prompt.
- Persistence: Rust `load_app_data` / `save_app_data` (atomic write to `<name>.json` in the app data dir), `src/lib/storage.ts` (localStorage fallback in the browser, debounced saves). Sources persist with their text and Tauri path; on launch done/error sources are restored and unfinished ones with a path are re-queued. Hydration runs from `main.tsx`.
- Verified: slider value survives a reload; an OCR'd source survives a reload with its text. Not persisted yet: the paper and the chat thread.

### 2026-09-15 — Logo (v2, graphic profile)
- First attempt (front-facing illustrated tiger) rejected by the user as too pictorial. Replaced with a graphic mark: a solid angular tiger head in side profile, stripes cut in as tapered ink wedges, the open mouth as negative space, a sheet clamped between the fangs (dimmed inside the mouth so the teeth read), folded ember corner.
- Sources: `design/logo-mark.svg` (mark, transparent), `design/app-icon.svg` (ink squircle + tiger glow), `design/app-icon.png` (1024 render for `npx tauri icon`), previews `design/logo-mark.png`, `design/logo-mark-64.png`.
- Applied: `src-tauri/icons/*` regenerated (mobile sets removed), `public/favicon.svg`, `src/assets/logo.svg` in the rail and the wizard welcome.
- Regenerate icons after editing the SVG: `qlmanage -t -s 1024 -o design design/app-icon.svg && mv design/app-icon.svg.png design/app-icon.png && npx tauri icon design/app-icon.png`, then delete `src-tauri/icons/{android,ios}`.

### 2026-11-19 — Dev launch config
- `.claude/launch.json` runs the browser preview on port **1430** (`npm run dev -- --port 1430`) so it never collides with `npm run tauri dev`, which needs 1420.

### 2026-11-19 — UX v3 "Sketchbook" plan (Opus)
- Restyle after the user's reference sheet `design/tiger-emotions-sheet.jpg`: pencil-sketch "Tiger Emotions & States", cream paper, graphite ink, hand-lettered caps, pink blush, 36 tiger poses. Orange and glass are dropped.
- Decisions:
  - Light **Sketchbook** is the new default; dark **Night** is kept, with each tiger on a cream sticker.
  - Fonts are Patrick Hand (display) and Nunito (body).
  - The cartoon component language is wobbly hand-drawn borders, hard offset shadows, pencil hatching (replacing the stripes) and doodle underlines.
  - All 36 tigers cycle as the app icon every 5 s, pinned to a mood while the app is busy.
  - The paper panel is wider and resizable.
  - The Dock icon is unchanged.

### 2026-11-19 — UX v3 "Sketchbook" implemented (Sonnet)
- **Sprites:** `design/tools/cut_tiger_sheet.py` (dev-only, Python/PIL, not part of the build) cuts the sheet into `src/assets/tiger/<state>.webp`. There are 36 at 320 px, about 800 KB in total. Paper is removed with an edge flood fill, and neighbour specks with an edge-component rule.
- **Tiger:**
  - `src/lib/tiger.ts` has `TIGER_STATES`, one global 5 s ticker (paused while hidden) and `useTigerMood()`. Mood priority is writing > talking > thinking > reading > sad.
  - `src/components/ui/Tiger.tsx` (`<Tiger cycle|state size/>`) swaps poses with a flip animation.
  - Tigers appear in the rail, the title bar, the chat avatar, empty states, the paper panel, Draft, Voice, Settings and every wizard step.
- **Foundation:**
  - `src/index.css` is rewritten with token names kept: `--tiger` is now ink, `--rose` blush, and there are new `--danger` and `--line-soft` tokens.
  - New classes `.sketch`, `.sketch-alt`, `.wobble`, `.sketch-btn`, `.hatch`, `.doodle-underline`, `.highlighter` and `.paper-ground`. `.glass` and `.stripes` stay as aliases.
  - The window background is now opaque paper, so native vibrancy no longer shows.
  - `THEME_LABELS` live in `theme.ts`; the default theme is light.
- **Paper panel:** 480 px by default, resizable from 380 px to 50% with the mouse or the arrow keys. The width is persisted as `papertiger.paperPanelWidth`, and the preview shows 1800 characters.
- **Screens:** all six are restyled, with no logic changes beyond a `justDone` flag on Voice retrain.
- **Docs:** `docs/DESIGN.md` is rewritten as v3, with screenshots in `docs/ux-v3-*.png`.
- **Verified:**
  - `npm run build` and `npm run lint` are clean.
  - In the browser: the full wizard, all five screens, and Night mode with stickers.
  - The rail tiger advances every 5 s.
  - A real chat reply from local Ollama (qwen3 4B): the tiger goes thinking, then talking, then back to cycling.
  - Panel resize persists across a reload.
- Note: the Claude browser pane throttles `requestAnimationFrame` (about 2 fps) while it is hidden. That makes framer-motion route transitions look stuck in screenshots. It does not happen in a visible window.
- **Not yet done:**
  - Visual QA inside the Tauri window. `npm run tauri dev` builds and launches, but it has not been checked by eye after the restyle.
  - A reduced-motion pass by hand.
  - The Dock icon still shows the v2 logo. (Done in the next entry.)

### 2026-11-19 — Idle tiger as the app icon (Sonnet)
- `design/tools/make_app_icon.py` is dev-only and reuses the cutter's `cut()`. It renders `design/app-icon.png` at 1024 px:
  - an 824 px cream squircle (185 px radius) with faint grain, a 7 px ink border, and a hard plus a soft shadow;
  - the idle tiger, cut from the sheet at native resolution (494×609) and upscaled with LANCZOS to about 74% of the squircle height;
  - the line work treated as graphite alpha with a contrast curve, so the tiger stays legible at 32 px.
- The v2 icon sources were moved to `design/legacy/`.
- `src-tauri/icons/*` were regenerated with `npx tauri icon design/app-icon.png`, and the android and ios folders were removed.
- The favicon is now `public/favicon.png` (64 px), referenced from `index.html`.
- Regenerate the icon with `/opt/homebrew/bin/python3 design/tools/make_app_icon.py [preview.png]`, then run `npx tauri icon design/app-icon.png`.
- Verified: preview checked at 1024, 128, 64, 32 and 16 px on light and dark; `npm run build` is clean; `tauri dev` relaunched with the fresh binary. The Dock was not checked by eye.

### 2026-11-19 — Taller header with "Paper Tiger" wordmark (Opus plan, Sonnet build)
- Merged `main` (the user's push of `design/title_paper_tiger.jpeg` and two Gemini sheets) into the branch as `27de453`.
- **Header** (`src/components/ui/TitleBar.tsx`):
  - 44px is now **72px**.
  - The cycling tiger moved from the rail into the header's left corner (56px, 16px inset).
  - After it come the brush-ink wordmark (about 40px tall, a CSS mask filled with `--fg`, so it goes chalk on Night), a hand-drawn slash, and the muted page name.
  - The pill lost its small tiger.
  - The rail (`Sidebar.tsx`) no longer has a logo.
- **Wordmark:** `design/tools/make_wordmark.py` (dev-only) produces `src/assets/wordmark-paper-tiger.png` (358×96, 16 KB).
- **Verified:**
  - `npm run build` and `npm run lint` are clean.
  - In the browser, the header measures 72px, the tiger sits at x=16, and the wordmark is clean in Sketchbook and Night.
  - Screenshots are `docs/ux-v3-header.png` and `docs/ux-v3-header-night.png`.
- **Not verified:** the Tauri window, where macOS traffic lights could overlap the corner tiger. The unbundled dev binary can't be reached by computer use. If lights show, set `LEFT_INSET_PX` to about 80.
- **Not used yet:** the "Tiger Reading & Writing" sheet (`design/Gemini_Generated_Image_akn2m6akn2m6akn2.jpeg`, 12 poses).

### 2026-11-19 — Window dragging fixed (Opus plan, Sonnet build)
- **Cause:** the frameless window can only be moved through `data-tauri-drag-region`, which calls `start_dragging`. That command is not part of `core:default`, so every drag was silently denied.
- **Fix:**
  - `src-tauri/capabilities/default.json` now also grants `core:window:allow-start-dragging` and `core:window:allow-internal-toggle-maximize` (double-click the header to zoom).
  - The header's right-hand wrapper now also carries `data-tauri-drag-region`. Tauri only drags when the mousedown target itself has the attribute; the left group is `pointer-events-none`.
- **Rule:** any new window command used from the frontend (minimize, close, set size…) needs its own `core:window:allow-*` permission in the capability file.
- **Verified:** `npm run build` and `cargo check` are clean; the relaunched dev binary contains the permission. The drag itself still needs a hand test, because computer use can't reach the unbundled dev binary.

### 2026-11-19 — Floating pencil frames and a rounded window (Opus plan, Sonnet build)
- **Goal:** the user found the straight, full-bleed column borders too strict. They wanted rounded app corners, space between the columns, and lines that look drawn with a pencil.
- **Desk:** the app root is now a rounded desk (`rounded-[22px]`, `--desk` token) with 12px padding and gaps. The header, rail, main column and paper panel float on it as separate cards. The gaps are drag regions.
- **Tauri:** `main.tsx` adds `html.tauri`, which makes html, body and #root transparent so the window corners are really rounded (the window already has `transparent: true`).
- **Pencil lines:**
  - `src/lib/sketchPath.ts` is a seeded wobbly rounded-rect path generator.
  - `src/components/ui/SketchFrame.tsx` draws the shadow, the fill and a double pencil stroke as SVG behind its children, with a ResizeObserver and no filters.
  - It is used for the header, rail, main card, paper panel (with the tape and tilt kept), the wizard card and the window outline.
- **Screens:** solid full-width heading rules in Sources and Draft are now dashed `--line-soft`.
- **Verified:**
  - `npm run build` and `npm run lint` are clean.
  - In the browser: 12px gutters, header 12px from the top, rail 84px wide, the double strokes, Night mode and the wizard card.
  - Screenshots are `docs/ux-v3-frames.png` and `docs/ux-v3-frames-night.png`.
- **Not verified:** rounded transparent corners, gap dragging and edge resizing inside the Tauri window. These need the user's eyes, since computer use can't reach the dev binary.
- **Follow-up option:** use `SketchFrame` for the larger inner cards too (chat bubbles, Settings sections, source rows).

### 2026-11-19 — Reading & writing tigers as live status (Opus plan, Sonnet build)
- **Sprites:** the "Tiger Reading & Writing" sheet is now `design/tiger-reading-writing-sheet.jpg`.
  - `cut_tiger_sheet.py` takes `--sheet emotions|reading-writing`. The emotions sprites are unchanged byte for byte.
  - There are 12 new 320px WebP poses with their props kept (about 300 KB in total). Preview: `docs/ux-v3-status-poses.png`.
  - `TIGER_STATES` is now 48, and all 48 join the 5 s cycle.
- **Status engine** (`src/lib/tiger.ts`):
  - `useTigerStatusEngine()` is mounted once in `App.tsx`. It replaces the per-instance `useTigerMood`, which is kept as an alias.
  - One module store is read by every `<Tiger cycle>`.
  - Writing: picking-up-pencil, then thinking-before-writing after 2 s with no text, then writing-intently or scribbling-fast (40 chars/s over a 2 s window). A 4 s finished-page flash follows.
  - Reading: opening-book, focused-reading, sleepy-reading after 45 s on one page, a 1.5 s turning-page flash, and a 4 s amazed-reading flash when a source is done.
  - Errors: erasing-mistake for a writer failure, sad for a source failure.
  - `flashTiger` and `suppressFinishFlash` are exported. The only change to `writer.ts` is calling them in the catch and on Stop.
  - A 500 ms poll runs only while something is active.
  - `tigerForSource` drives the Sources rows. The drop zone shows `taking-notes` when sources exist and none is running.
  - The paper panel and Draft tigers now follow the engine.
- **Bug fixed during verification:** the seeded mock chat ends with a user message, which pinned `thinking` forever. Messages present at the engine's first run are now ignored, like restored sources.
- **Verified in the browser against local Ollama:**
  - `npm run build` and `npm run lint` are clean.
  - Real OCR of `docs/sample-page.pdf`: opening-book, then focused-reading, then amazed-reading for 4 s, then the cycle.
  - Real qwen3 4B generation: picking-up-pencil, then scribbling-fast, then finished-page for 4 s, then the cycle.
  - Stop: back to the cycle with no finished-page.
  - Missing model (a Gemma writer id set temporarily in the preview's localStorage, then restored): a 404 shows erasing-mistake for 4 s.
  - Screenshots are `docs/ux-v3-status-writing.png` and `docs/ux-v3-status-header.png`.
- **Not seen live:** thinking-before-writing (the model was warm), turning-page (the sample PDF has one page), and sleepy-reading (45 s). These follow from timers and code review only.
- **Test note:**
  - In the hidden browser pane, `requestAnimationFrame` stops completely, so pdf.js rendering stalls and framer-motion exits pile up in the DOM.
  - Show the pane before testing OCR.
  - Read the tiger's state from its React props, not from the `<img>` list.

### 2026-11-19 — Draft editor streaming gap fixed (Opus plan, Sonnet build)
- **Cause:** while a section was writing, `EditorScreen` kept the textarea frozen at the pre-generation text (`min-h-[200px]` plus the placeholder) and showed the stream below it as `content.slice(generationBase.length)`.
  - On an empty section this left a blank 200px box.
  - The real writer *replaces* content, so regenerating a section with text would have cut the first N characters off the new text.
- **Fix:** while the current section writes, the card shows the live `content` read-only with the caret, in place of the textarea. When it's done, the editable textarea comes back. `generationBase`, `streamedText` and the textarea auto-height effect are gone.
- **Mock generator:** Stop now ends in `'done'` with the partial text, like the real writer, and calls `suppressFinishFlash()`. Before, the section stayed `'writing'` forever.
- **Verified in the browser:**
  - `npm run build` and `npm run lint` are clean.
  - A real qwen3 4B run on an empty section streams directly under "writing…" (`docs/ux-v3-draft-writing.png`).
  - Regenerating Abstract streams only the new text. Stop leaves the partial text editable.
  - Mock Stop leaves the section editable, and the header tiger returns to the cycle with no finished-page.
- **Test note:** after Vite hot updates, `await import('/src/lib/paper.ts')` in the console gets a separate, stale store; the app uses `paper.ts?t=…`. Check through the DOM, or reload first.

### 2026-11-20 — Humanize replaces Voice (Opus plan, Sonnet build)
- **Rail:** Voice is gone, and **Humanize** (`/humanize`, Wand2) sits between Draft and Settings. The paper panel is hidden on Humanize.
- **Voice sliders:** formality, conciseness and technicality moved into a "Writing style" card in Settings, and the writer still uses them. `StyleScreen.tsx` and `mock/styleMetrics.ts` were removed.
- **Engine (`src/lib/humanize/`):** a 1:1 TypeScript port of Persephone's `server/humanize.py`.
  - Block segmentation and classify: headings, table headers, captions, labels and questions are kept. In "Question? answer" and "Label: text" blocks only the answer part is rewritten.
  - The EN/NL prompts are verbatim. A throwaway parity test matched all 96 prompt variants and the guard cases against the Python source.
  - Language detection, `cleanOutput`, the quality guard (one retry at 0.2, then keep and flag), `num_predict` per block, `num_ctx` as a power of two in 8K–32K, and up to 3 continuations.
  - Papertiger additions:
    - OCR `a | b` row tables are recognised.
    - HTML `<table>` blocks: those with rows become cells, those without are kept verbatim. The Q4 OCR model can emit `<table>` with no `<tr>`.
  - 39 vitest tests (`npm test`).
- **Store and UI:** `humanizeStore.ts` and `HumanizeScreen.tsx`.
  - Pick a done source, then Tone (4) and Strength (3), then Humanize / Cancel.
  - While running: "block k/M · elapsed · tok/s" and a live draft in italics.
  - Afterwards: a flagged-blocks note, Copy (markdown), Download .docx (the `docx` package builds a fresh document; Tauri saves through the dialog plus a new Rust `save_file_bytes` command), and Clear.
  - The model is the configured writer.
- **Tiger:** humanize is `picking-up-pencil` before the first token of a block, then `erasing-mistake`. A finished run flashes `finished-page`, or `sad` if any block was flagged. Cancel flashes nothing.
- **Verified in the browser with real OCR and qwen3 4B:**
  - Runs go through block k/M. Cancel mid-run keeps the partial result.
  - The .docx is a valid file (17 parts) and renders in Quick Look.
  - The Settings sliders persist across a reload.
  - Screenshots: `docs/ux-v3-humanize.png`, `docs/ux-v3-humanize-running.png` and `docs/ux-v3-settings-writing-style.png`.
- **Quality note:** qwen3 4B often drops citations like `[1, 2]` or writes "6 to 12" for "6-12". The guard then keeps those blocks original and flags them; 2 of 3 blocks on the sample page. A larger writer passes more often (Persephone recommends gemma4).
- **Not verified:** the Tauri save dialog for .docx (computer use can't reach the dev binary). Tauri dev was restarted with the new command.
- **Test note:** both the rail item and the run button are labelled "Humanize", so pick the run button explicitly when scripting.

<!-- Add new entries above this line, newest last. -->



### 2026-11-20 — Humanize collections and manual review; one-word wordmark (Opus plan, Sonnet build)
- **Collections:** Humanize takes several documents at once.
  - The source chips are multi-select (Select all / Clear, "n selected · N words").
  - A preview grid shows one taped card per document: Queued / Humanizing k/M / Done / n kept / Cancelled / Error, with the first lines and Copy / .docx per card. Clicking a card shows its full result below.
  - Documents run one after another; the status line reads "Document k of N · block i/M · elapsed · tok/s". Cancel stops the running one and marks the queued ones cancelled; finished ones stay.
- **Store:** `src/lib/humanizeStore.ts` is now a batch (`jobs`, `order`, `runningId`, `DocJob` per source). `effectiveOutputs(job)` applies review decisions and feeds the previews, the full result, Copy and .docx. `run.ts` now also reports the guard-rejected rewrite of a flagged block.
- **Manual review:** a "Manual review" checkbox adds a Review button to finished cards. `src/components/humanize/ReviewPortal.tsx` shows each rewritten or flagged block side by side (original with struck `--danger` deletions, rewrite with blush insertions, word diff from `src/lib/humanize/diff.ts` on jsdiff). Per block: Keep, Revert, Edit, and "Use rewrite anyway" for guard-kept blocks. Keep all / Revert all, and an optional "Show unchanged blocks".
- **Wordmark:** `make_wordmark.py` closes the word gap and overlaps the halves (`GAP_OVERLAP` 0.14, alpha max), so the header reads "PaperTiger". The PNG is 324×96, `WORDMARK_RATIO` 324/96.
- **Verified in the browser against local Ollama (qwen3 4B):**
  - `npm test` (43), `npm run build` and `npm run lint` are clean.
  - Two documents ran in sequence; Cancel during document 2 kept document 1 done and marked document 2 cancelled.
  - Review: "Use rewrite anyway", Edit + Save and Revert all changed the counts; Copy and the .docx (`word/document.xml` decoded) contained the edited text and the reverted original.
  - The wordmark in the header in Sketchbook and Night.
  - Screenshots: `docs/ux-v3-humanize-collection.png`, `docs/ux-v3-humanize-review.png`.
- **Known rough edges:** after review, the card badge ("2 kept") and the "n blocks kept as in the original" note still count the guard's flags, not the decisions; a guard note ("missing: 6-12") stays on a block after you edit it. The portal has no exit animation. An OCR `<table>` without cells still shows as raw markup in the result view.
- **Not verified:** the Tauri window (save dialog, look of the portal at full width).

### 2026-11-20 — Kept counts follow review decisions (Opus plan, Sonnet build)
- `unresolvedFlags(job)` in `humanizeStore.ts` gives the flagged blocks with no review decision.
- It drives three things:
  - the card badge: "n kept" while any remain, then "Reviewed" once you have decided, else "Done";
  - the "n blocks kept as in the original" note under the result;
  - the portal's "kept by the guard" count. A reverted flagged block was counted twice before.
- Verified in the browser with real qwen3 4B on `sample-page-2` (2 flagged):
  - 2 kept;
  - Revert one: 1 kept;
  - Edit the other: 0, with Reviewed and no note;
  - Keep the first again: back to 1 kept.
- Build, lint and the 43 tests are clean.

### 2026-11-20 — Review guard note follows the current text (Opus plan, Sonnet build)
- **Change:** the review portal's per-block guard note now describes the text the block will use, not the rejected rewrite.
  - Reverted blocks show no note.
  - Edited blocks are re-checked with the new `checkEdit` in `guard.ts`. That is `checkBlock` with no length bounds, so facts, quotes and repeats are still checked. The note shows "Still missing: …" in `--danger`, or nothing if the edit passes. This also covers edits of ordinary rewrites.
  - Blocks with no decision keep the guard's original note.
- `DocJob.strength` records the strength the document ran with, for the re-check.
- **Verified in the browser** with real qwen3 4B on `sample-page-2`:
  - Revert clears the "missing: 6-12" note.
  - An edit without "(RRT)" shows "Still missing: RRT", and restoring it clears the note.
  - "Use rewrite anyway" shows "Still missing: 6-12".
- **Checks:** 46 tests, build and lint are clean.
- **Note:** the guard matches 1–2 digit numbers as standalone digits, so "[1, 2]" counts as present when "6-12" is in the text. That is inherited from Persephone and left as is.

### 2026-11-20 — Humanize: open and save every common document format (Opus plan, Sonnet build)
- **Input** (`src/lib/extract/`): docx (mammoth → HTML), rtf, odt, epub (spine order), pages (IWA snappy + protobuf, preview.jpg OCR fallback), html, txt and md all become light markdown for the segmenter. doc, webarchive and wordml go through the new Rust `convert_with_textutil` (`/usr/bin/textutil`, app only; in the browser they say "Open this file in the app"). HEIC images are OCR'd.
- **Sources:** `SourceKind` 'document'. Text-native files skip the OCR queue and need no OCR model.
- **Add documents:** `src/lib/addFiles.ts` (`pickFiles`, `addFiles`, `useFileDrop`) is shared by Sources and a new Add documents button and drop zone on Humanize. New files are auto-selected once done.
- **Download** (`src/lib/humanize/export/`, `DownloadMenu`): docx, pdf (pdf-lib), rtf (`\uN\'3f` escapes), odt, html, md and txt. doc goes through the Rust `save_with_textutil` (app only). The last format used is remembered in `papertiger.humanizeExport`. Pages can't be written; the menu notes "Pages opens .docx".
- **Also:**
  - cards show the file type ("56 words · .md") and previews without markdown marks;
  - result lists use • bullets;
  - `startBatch` only runs done sources with text, and prunes stale selections.
- **Verified:**
  - In the browser, through a synthetic drop: all browser-readable formats extract, headings survive where the file has real heading styles, and files are auto-selected. .doc shows the in-app message.
  - Downloads: all 7 browser formats saved. The RTF and ODT read back correctly with `textutil` (accents, curly quotes, emoji). The PDF text was checked with pdf.js.
  - The `textutil` doc read and write commands, run as the Rust code calls them, keep the text intact.
  - 81 tests, build, lint and `cargo check` are clean.
  - Screenshots: `docs/ux-v3-humanize-add.png`, `docs/ux-v3-humanize-download.png`.
- **Not verified:**
  - the Pages parser against a real Pages file (only a synthetic IWA);
  - .doc in the Tauri window;
  - the native save dialogs and Finder drag-drop.
- **Test note:** `\u` sequences typed into Bash tool commands are decoded before they reach the shell. Move RTF samples as base64.

### 2026-11-20 — Text-layer extraction for digital PDFs (Opus plan, Sonnet build)
- **Extraction:** `src/lib/extract/pdfText.ts` reads a PDF page's text layer into light markdown. It groups items into lines by baseline and reads two-column pages left then right.
  - Paragraphs split on line gaps; hyphenated line breaks are joined.
  - Headings come from font size, with levels ranked document-wide via `fontProfileOfDocument`. Bullets become list items, and aligned rows become `| a | b |` tables.
  - A quality gate (`text` / `empty` / `garbled`) decides per page. `stripRunningLines` drops repeated headers, footers and page numbers.
- **Sources:** `processSource` opens the PDF once and walks the pages. Text pages are read directly; other pages are rendered alone and OCR'd, so memory stays low on 8 GB Macs. The note says how each file was read ("Read from the text (no OCR needed)", "Read 3 pages from the text, 1 with OCR"). With no OCR model, scanned pages are skipped with a note. The OCR model is only unloaded if OCR actually ran.
- **Setting:** Settings → Models → "PDF text": "Use the text when it's there" (default) or "Always use OCR" (keeps table layout better). Stored as `pdfTextLayer`.
- **Verified in the browser** (114 tests, build and lint clean):
  - `docs/sample-page.pdf` and a 3-page pdf-lib fixture finished in 0.58 s with no Ollama calls. Their headings (`#` title, `##` sections on every page), the paragraph split, the hyphen join, the bullets and the table were correct, and the footers were gone.
  - The text layer covers 97% of the earlier OCR words; every difference is the table, which OCR had glued together.
  - A mixed PDF read 3 pages from the text in 0.3 s and OCR'd the scanned page, with one OCR call and an unload afterwards.
  - "Always use OCR" sends the same digital PDF through OCR again.
  - Humanize on the digital fixture keeps the headings, the caption and every table cell, and rewrites only the paragraphs.
- **Simplified heuristics:**
  - Tables need equal cell counts and are not detected on two-column pages.
  - A bold run-in label stays inside its paragraph.
  - The garbled check has no vowel test, so a shifted font encoding could pass.
  - Page rotation is ignored.

### 2026-11-20 — Tiger card and left column (Opus plan, Sonnet build)
- **Why:** even at 84px the header tiger was too small to read its 48 poses. The top area is now split: a big tiger on the left, the PaperTiger header on the right.
- **Layout** (`src/App.tsx`, constants in the new `src/lib/layout.ts`): the desk is a row with a 152px left column (tiger card above the nav) and a right column (72px header above the main card and paper panel). Every column wrapper and the card root keep `data-tauri-drag-region`. `/setup` has no left column; its header spans the full width with no tiger.
- **`TigerCard`** (`src/components/ui/TigerCard.tsx`): a 128px tiger (`useTigerStatus() ?? useTigerCycle()`) with a caption from the new `tigerLabel()` in `tiger.ts`, plus a small hatch bar while busy. A visually hidden `aria-live="polite"` line announces only status poses, never the idle cycle.
- **Rail** (`Sidebar.tsx`): `<nav aria-label="Main">` with 44px horizontal rows (icon + label), `aria-current="page"`, a full-row highlighter.
- **Header** (`TitleBar.tsx`): back to 72px with no tiger; `LEFT_INSET_PX` is 20, the wordmark stays at 46px.
- **Paper panel:** `maxWidth()` now also keeps the main card at least 360px wide (400px max panel at a 960px window).
- Docs: `docs/DESIGN.md` updated (layout, header, tiger card and rail, panel width).
- Verified: build, lint and 114 tests clean. In the browser at 1280×800 and 960×640: the left column is 152px, the tiger 128×128, the header 72px starting at x=176, every rail row 44px with `aria-current` on the active one, and the page does not scroll. At 960 a stored panel width of 900 clamps to 400, leaving main at 360. A flashed `focused-reading` shows "Reading" with the hatch bar and fills the live region, which empties again afterwards. Tab shows the focus ring on the rail rows. Night mode keeps the sticker disc, and `/setup` has a full-width header with no tiger. Screenshots: `docs/ux-v3-header.png`, `docs/ux-v3-header-night.png`. Not checked by eye in the Tauri window.

### 2026-11-20 — Tiger card shows only the illustration (Opus plan, Sonnet build)
- The visible caption and the busy hatch bar under the tiger are removed from `TigerCard.tsx` at the user's request.
- The card is a 152×152 square with the 128px tiger centred in it.
- The tiger's `alt` and the hidden `aria-live="polite"` status line are kept, so status changes are still announced to screen readers.
- Docs: `docs/DESIGN.md` updated (tiger card and tiger-usage list).
- Verified: build and lint clean. In the browser at 1280×800 the card measures 152×152 with the tiger at 128×128 and no visible text; a flashed `focused-reading` still fills the live region with "Reading", which empties again afterwards. `docs/ux-v3-header.png` refreshed.

### 2026-11-20 — Tiger sprites with cut-off bodies fixed (Opus plan, Sonnet build)
- **Cause:** on the emotions sheet the bottom row's `label_top` (1921 preview units, sheet y 2305) sat 20–25 sheet px above the real feet, because the labels in that row start lower than in the other rows. The six sprites cut from it lost their feet or lower body; the user saw it on "hopeful" at 128px in the tiger card. The card itself was not clipping.
- **Fix:** `design/tools/cut_tiger_sheet.py` got a `label_top_override` of 1946 (sheet y 2335, inside the blank band 2333–2340 between feet and label text) for cells `(5,0)`–`(5,5)`. Fixed sprites: `nervous`, `hopeful`, `chilling`, `wonder`, `writing`, `reading`. No algorithm change.
- **`--check` flag:** `cut_tiger_sheet.py --sheet <name> --check` lists cells where ink touches the crop's last rows and continues more than 8px below it. Known false positives that are label text under a correct crop: emotions `sad` (~49px) and `frustrated` (~38px); reading-writing `finished-page` (9px, shadow).
- **Verified:** the other 30 emotions sprites and all 12 reading-writing sprites are byte-identical (md5 before and after; only the six changed). The six new sprites show full bodies with feet and no label-letter fragments. `npm run build` is clean.

### 2026-11-20 — Guided setup wizard (Opus plan, Sonnet build)
- **Why:** the user asked for every setup step to be covered, with Paper Tiger as a guide. The old 6-step wizard in one file only handled the model downloads.
- **Steps:** 12 steps in 6 chapters. Hello (welcome, privacy), Your Mac (mac, ollama), Models (ocr, writer, download), Preferences (pdf, style, look), Tour (tour), Done (done). Each step has its own guide line and pose, and the guide reacts live (Ollama found or missing, download state, PDF choice, style slider, Night, tour hover).
- **Structure:** `src/screens/setup/`:
  - the shell is `SetupWizard.tsx`;
  - `WizardContext.tsx` holds state and navigation;
  - `steps.ts` is the registry (id, chapter, guide line, pose);
  - `GuideTiger.tsx` is the 120px tiger with a speech bubble;
  - `Stepper.tsx` shows chapters, "Step k of 12" and dots;
  - there is one file per step in `steps/`.
  - The old `src/screens/SetupWizard.tsx` is removed. The current step is saved as `papertiger.setupStep`. Deep links are `?step=<id>` and `?from=settings`.
- **Settings:** a "Run setup again" button, and the OCR and writer Change buttons now deep-link to `/setup?step=ocr|writer&from=settings`.
- **Return-to-summary mode:** Done's Change buttons and the Settings deep links jump to one step, then go through download back to Done. The primary button reads "Back to summary", and the last one "Back to Settings" when opened from Settings.
- **Docs:** `docs/DESIGN.md` has a new "Setup wizard" section. Screenshots are `docs/ux-v3-wizard-look-night.png`, `docs/ux-v3-wizard-tour.png` and `docs/ux-v3-wizard-pdf.png`.
- **Verified:**
  - Build, lint and 114 tests are clean.
  - In the browser at 1180×780 and 960×640, all 12 steps were walked forward with the expected pose and guide line per step and "Step k of 12". Focus lands on each step heading.
  - Ollama: found → excited; fetch blocked → confused with Continue disabled; unblocked → excited within the 3 s re-check.
  - OCR Q4 and Qwen3 4B Q4 both "Already on this Mac" → finished-page.
  - The PDF choice persists `pdfTextLayer` and switches the pose.
  - A style slider flicks scribbling-fast and updates the preview.
  - Night applies live with the chilling pose.
  - Tour hover changes pose and line.
  - Done lists all five choices, and each Change returns via "Back to summary".
  - A reload resumes on the saved step.
  - `?step=writer&from=settings` goes writer → download → summary with "Back to Settings".
  - At 960×640 the guide and footer stay visible and the content scrolls.
- **Not verified:** the Tauri window by eye, and a real model download (all models were already pulled).
- **Test note:** React's `onMouseEnter` does not fire for synthetic `mouseenter` events. Use the browser tool's hover.
