# Phase 2 — Real OCR via Ollama, hardware check, first-run wizard

Read `docs/DESIGN.md` first for visual rules. This document is the implementation
contract: module boundaries, exact TypeScript APIs and behaviours. Agents implement
their assigned slice against these APIs and must not change them without noting it.

## Scope
1. **Hardware check** of the Mac (Rust command) + OCR quant recommendation.
2. **Ollama client** (webview `fetch` to `http://localhost:11434`; Ollama's default
   CORS allow-list includes `tauri://*` and `http://localhost:*`).
3. **Source loading**: PDFs rendered to PNG pages with pdf.js, images read directly,
   DOCX converted to text with mammoth (no OCR needed for DOCX).
4. **First-run wizard** (`/setup`): welcome → your Mac → choose OCR model (recommended
   card highlighted) → download with progress → done. Shown until setup is marked done.
5. **Sources screen** uses real files (native file dialog + native drag-drop) and runs OCR
   page by page through Ollama with live progress.

Everything is TypeScript/Node/Rust. No Python.

## Dependencies
npm: `pdfjs-dist`, `mammoth`, `@tauri-apps/plugin-dialog`.
cargo (`src-tauri/Cargo.toml`): `tauri-plugin-dialog = "2"`.
Capabilities (`src-tauri/capabilities/default.json`): add `"dialog:default"`.

## Rust commands (`src-tauri/src/lib.rs`)
```rust
#[derive(serde::Serialize)]
struct HardwareInfo { chip: String, apple_silicon: bool, ram_gb: f64, macos_version: String, cpu_cores: u32 }
#[tauri::command] fn hardware_info() -> Result<HardwareInfo, String>
// chip: `sysctl -n machdep.cpu.brand_string`; apple_silicon: `sysctl -n hw.optional.arm64` == "1"
// (or std::env::consts::ARCH == "aarch64"); ram_gb: hw.memsize / 2^30 rounded to 1 decimal;
// macos_version: `sw_vers -productVersion`; cpu_cores: hw.ncpu. Shell out with std::process::Command.
#[tauri::command] fn read_file_base64(path: String) -> Result<String, String>   // whole file, standard base64
#[tauri::command] fn file_size(path: String) -> Result<u64, String>
```
Register with `.invoke_handler(tauri::generate_handler![hardware_info, read_file_base64, file_size])`
and `.plugin(tauri_plugin_dialog::init())`.

## `src/lib/tauri.ts`
```ts
export const isTauri = (): boolean   // 'window.__TAURI_INTERNALS__' in window
```

## `src/lib/hardware.ts`
```ts
export interface HardwareInfo { chip: string; appleSilicon: boolean; ramGb: number; macosVersion: string; cpuCores: number; source: 'tauri' | 'browser' }
export async function getHardwareInfo(): Promise<HardwareInfo>
// Tauri: invoke('hardware_info'). Browser fallback: chip 'Unknown (browser preview)', appleSilicon false, ramGb 0, macosVersion from navigator.userAgent if parsable else '', source 'browser'.
export type Quant = 'q8' | 'q4'
export interface Recommendation { quant: Quant; reason: string }
export function recommendQuant(hw: HardwareInfo): Recommendation
// q8 iff appleSilicon && ramGb >= 16. Reasons (sentence case, plain):
//  q8: "Apple Silicon with {ram} GB: the 8-bit model fits with room to spare and reads a page in seconds."
//  q4 (apple, <16): "{ram} GB of memory: the 4-bit model leaves room for macOS and the app. Text accuracy is the same."
//  q4 (intel): "Intel Mac: OCR runs on the CPU, so the smaller 4-bit model is the practical choice. Expect a minute or more per page."
//  q4 (unknown/browser): "Hardware could not be read: defaulting to the smaller 4-bit model."
```

## `src/lib/models.ts`
```ts
export interface OcrModel { quant: Quant; tag: string; label: string; downloadGb: number; residentGb: number; blurb: string }
export const OCR_MODELS: Record<Quant, OcrModel> = {
  q8: { quant: 'q8', tag: 'frob/unlimited-ocr:q8_0', label: 'Unlimited-OCR · 8-bit', downloadGb: 4.0, residentGb: 5.0, blurb: 'Full quality. Best on Apple Silicon with 16 GB or more.' },
  q4: { quant: 'q4', tag: 'hf.co/DevQuasar/baidu.Unlimited-OCR-GGUF:Q4_K_M', label: 'Unlimited-OCR · 4-bit', downloadGb: 2.8, residentGb: 3.8, blurb: 'Same text accuracy, 1.2 GB less memory. Right for 8 GB Macs and Intel.' },
}
export const OCR_NUM_CTX = 8192
// Ollama lowercases the tag on registration ("...:q4_k_m"); match models case-insensitively.
export function sameTag(a: string, b: string): boolean
```

## `src/lib/settings.ts`
Tiny external store persisted to `localStorage['papertiger.settings']` (JSON).
```ts
export interface AppSettings { setupDone: boolean; ocrQuant: Quant | null; ocrTag: string | null }
export function readSettings(): AppSettings         // defaults: { setupDone: false, ocrQuant: null, ocrTag: null }
export function updateSettings(patch: Partial<AppSettings>): void
export function useSettings(): AppSettings          // useSyncExternalStore-based, re-renders on updateSettings
```

## `src/lib/ollama.ts`
Base URL `http://localhost:11434`. All functions throw `OllamaError` (class with `kind: 'offline' | 'http' | 'parse'`).
```ts
export interface OllamaStatus { online: boolean; version?: string }
export async function getStatus(): Promise<OllamaStatus>              // GET /api/version, 1.5 s timeout → online false
export interface OllamaModel { name: string; sizeBytes: number }
export async function listModels(): Promise<OllamaModel[]>            // GET /api/tags
export async function hasModel(tag: string): Promise<boolean>         // sameTag against listModels
export interface PullProgress { status: string; completed?: number; total?: number; percent: number }
export async function pullModel(tag: string, onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void>
// POST /api/pull {name, stream:true}; parse NDJSON lines from the ReadableStream; percent = completed/total*100 for layers, 100 on "success".
export interface OcrBlock { label: string; bbox: [number, number, number, number] | null; text: string }
export async function ocrImage(tag: string, pngBase64: string, signal?: AbortSignal): Promise<{ raw: string; blocks: OcrBlock[]; text: string }>
// POST /api/generate {model, prompt: 'ocr', images: [pngBase64], stream: false, options: { num_ctx: OCR_NUM_CTX }, keep_alive: '10m'}
export function parseOcrOutput(raw: string): OcrBlock[]
// Lines look like: `text [21, 83, 960, 178]Early detection ...`, `title [23, 66, 124, 82]Abstract`,
// `table [24, 313, 594, 358]<table>...</table>`. Discard everything before the first line matching
// /^([a-z_]+) \[(\d+), (\d+), (\d+), (\d+)\](.*)$/ (both quants emit a junk preamble like "v: T1").
// A line that does not match continues the previous block's text (join with a space). Strip `\( \)` LaTeX
// wrappers like `\(90\%\)` → `90%`. For `table` blocks keep the HTML in `text`.
export function blocksToText(blocks: OcrBlock[]): string
// title/header/section blocks → their own paragraph; text blocks → paragraph; table → rows joined with " | " if
// parseable, else raw; blank line between blocks.
```

## `src/lib/sources.ts`
```ts
export type SourceKind = 'pdf' | 'image' | 'docx'
export type SourceStatus = 'queued' | 'rendering' | 'extracting' | 'done' | 'error'
export interface SourcePage { index: number; pngBase64: string; text?: string }
export interface Source {
  id: string; name: string; kind: SourceKind; sizeBytes: number; addedAt: Date;
  status: SourceStatus; progress: { page: number; pages: number }; pages: number;
  text: string; error?: string
}
export type SourceInput = { path: string } | { file: File }        // Tauri path or browser File
export function kindFromName(name: string): SourceKind | null      // pdf / png,jpg,jpeg,webp,gif,tiff,bmp / docx; null otherwise
export async function readBytes(input: SourceInput): Promise<{ name: string; bytes: Uint8Array }>
// Tauri: invoke('read_file_base64') → decode; browser: file.arrayBuffer().
export async function renderPdfPages(bytes: Uint8Array, opts?: { scale?: number; maxPages?: number }): Promise<SourcePage[]>
// pdfjs-dist; workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
// scale default 1.6 (≈115 dpi for A4, close to the 1236×1600 benchmark page); canvas → toDataURL('image/png') → strip prefix.
export async function imageToPng(bytes: Uint8Array, mime: string): Promise<SourcePage>   // via createImageBitmap + canvas; caps longest side at 2000 px
export async function docxToText(bytes: Uint8Array): Promise<string>   // mammoth.extractRawText
export async function processSource(
  input: SourceInput, ocrTag: string,
  onUpdate: (patch: Partial<Source>) => void, signal?: AbortSignal
): Promise<void>
// Orchestrates: read → (pdf: rendering, then extracting page by page, updating progress.page / pages and appending text)
//                    → (image: single page OCR) → (docx: text directly, status done, pages 1)
// Errors: OllamaError offline → error "Ollama is not running. Start it and try again."; other → error message.
```

## `src/lib/setup.ts` (wizard state helpers)
```ts
export function needsSetup(): boolean   // !readSettings().setupDone
```

## Screens
### `src/screens/SetupWizard.tsx` — route `/setup`
Full-bleed screen (no rail: App renders it outside the frame, but keep the TitleBar so the window stays draggable).
Steps as a horizontal stepper (mono uppercase labels, tiger dot for the current step):
1. **Welcome** — display headline "Meet papertiger", three one-liners (reads your sources on-device; writes in your voice; nothing leaves this Mac), primary "Get started".
2. **Your Mac** — a `GlassCard` with a mono definition list: Chip, Memory, macOS, Cores, Ollama (mint `Chip` "Running · v0.x" or rose "Not found"). If Ollama is not running: muted explanation, secondary "Open ollama.com/download" (opens via `window.open`, fine in Tauri), and "Check again". "Continue" is disabled until Ollama is online.
3. **OCR model** — two selectable cards (q8, q4) from `OCR_MODELS`; the recommended one carries a tiger `Chip mono` "RECOMMENDED" and the `Recommendation.reason` under the cards. Show download size and memory in use in mono. Pre-select the recommendation. Primary "Use this model".
4. **Download** — if `hasModel(tag)` → mint "Already on this Mac", else start `pullModel` immediately: an active `Stripe` above a progress bar (tiger fill), mono `1.3 GB of 2.8 GB · 46%` and the Ollama status string. Cancel returns to step 3. On success → step 5.
5. **Done** — "You're set", summary line (model label, resident memory), primary "Open Sources" → `updateSettings({ setupDone: true, ocrQuant, ocrTag })`, navigate `/references`.
Persist `ocrQuant`/`ocrTag` as soon as a model is chosen so re-opening the wizard resumes sensibly. Respect DESIGN.md motion rules. Use `layoutId="wizard-pill"` for the selected model card border if you animate it.

### `src/App.tsx`
- Add route `/setup` rendered WITHOUT the rail (TitleBar + wizard only).
- On mount, if `needsSetup()` and the path is not `/setup`, `navigate('/setup', { replace: true })`.

### `src/screens/SettingsScreen.tsx`
Models section: the OCR row shows the chosen model label + tag (mono) and a ghost "Change" button that navigates to `/setup`. If none chosen, show "Not set up" with the same button. Writer row unchanged.

### `src/screens/ReferencesScreen.tsx` (Sources)
- Replace mock data with real `Source[]` state (start empty; empty state per DESIGN.md).
- "Choose files": Tauri → `open({ multiple: true, filters: [{ name: 'Documents', extensions: ['pdf','png','jpg','jpeg','webp','gif','tiff','bmp','docx'] }] })` from `@tauri-apps/plugin-dialog`; browser → hidden `<input type="file" multiple>`.
- Drag-drop: Tauri → `getCurrentWebview().onDragDropEvent` (`over` → drag state, `drop` → paths, `leave`); browser → HTML5 drop with `dataTransfer.files`. Unsupported types → a rose `Chip` toast line "Skipped {name}: not a PDF, image or DOCX" for 4 s.
- Each source row: type badge, name, mono meta `12 pages · 2.4 MB · just now`, `StatusChip` (queued → idle, rendering/extracting → processing, done → success, error → error) with label text `Queued` / `Rendering` / `Extracting 3/12` / `Extracted` / `Failed`; active `Stripe` along the bottom edge while rendering/extracting; ghost Preview (disabled until text exists) and danger Remove (aborts via AbortController if running).
- Sources are processed sequentially through a small queue (one OCR at a time; Ollama is loaded once).
- If no OCR model is configured (`readSettings().ocrTag` null) show a tiger-tinted banner "Pick an OCR model first" with a button to `/setup`; PDFs/images stay queued; DOCX still works.
- Preview modal: meta grid + extracted text (`whitespace-pre-wrap`, `max-h-[60vh] overflow-auto`, mono 13px) and a secondary "Copy text" button (`navigator.clipboard.writeText`).
- Header sub-copy: "Everything the paper will be built on. Text is extracted on this Mac."

## Verification each agent must run
`npm run build` (zero TS errors), `npm run lint`, and for Rust changes `cargo check` in `src-tauri`.
