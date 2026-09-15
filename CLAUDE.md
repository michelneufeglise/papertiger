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

<!-- Add new entries above this line, newest last. -->


