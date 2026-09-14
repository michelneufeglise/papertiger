# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**papertiger** — a local macOS application for generating scientific papers based on research and publications. Targets older hardware (e.g. an older MacBook Air) and runs fully local.

### Product spec
- **Target:** macOS app that runs well on an older MacBook Air. Ships as a native `.app`, easy to install.
- **OCR:** local `unlimited-OCR` model parses uploaded content.
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
- **Local LLM runtime (later phase):** node-llama-cpp or similar — no Python.
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

<!-- Add new entries above this line, newest last. -->


