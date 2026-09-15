# Phase 3 — Writer LLM via Ollama, optional writer step in the wizard

Read `docs/DESIGN.md` (visuals) and `docs/PHASE2-OCR.md` (existing lib contracts) first.
This document is the contract for Phase 3. Implement APIs exactly; note any deviation.

## Scope
1. Writer model catalog: Qwen 3, Gemma 3, DeepSeek-R1 — each in Q4_K_M and Q8_0, two sizes —
   with a hardware fit rule and a recommendation.
2. Wizard gets an optional **Writer** step (skippable). Download step pulls OCR then writer.
3. Sources move into a shared store so the writer can read extracted text (and so sources
   survive navigation).
4. Real generation: Draft "Generate", the paper panel, and Chat use the writer model through
   Ollama's streaming chat API. Mock stream remains the fallback when no writer is set.

## Catalog — `src/lib/models.ts` (add; keep OCR_MODELS as is)
```ts
export type WriterFamily = 'qwen' | 'gemma' | 'deepseek'
export interface WriterModel {
  id: string                 // e.g. 'qwen-4b-q4'
  family: WriterFamily
  tag: string                // exact Ollama tag
  label: string              // e.g. 'Qwen3 4B · Q4'
  params: string             // '4B' | '8B' | '12B' | '1.5B'
  quant: 'q4' | 'q8'
  downloadGb: number
  residentGb: number         // downloadGb + ~1.2 GB KV/overhead at 8K context, rounded to 1 decimal
  thinking: boolean          // model can think; we send `think: false`
  stripThink: boolean        // distill models emit <think>…</think> inline; strip it
  quality: number            // 1..10 ordering for recommendation
}
export const WRITER_FAMILIES: Record<WriterFamily, { name: string; blurb: string }> = {
  qwen:     { name: 'Qwen 3',       blurb: 'Best all-round academic writer. Strong grammar, multilingual.' },
  gemma:    { name: 'Gemma 3',      blurb: 'Clear, concise prose. Light on memory.' },
  deepseek: { name: 'DeepSeek-R1',  blurb: 'Reasons before it writes. Slower, stronger on argument structure.' },
}
export const WRITER_MODELS: WriterModel[] = [
  // Qwen 3 (instruct 2507 for 4B; 8B is the hybrid thinking model → think:false)
  { id:'qwen-4b-q4', family:'qwen', tag:'qwen3:4b-instruct-2507-q4_K_M', label:'Qwen3 4B · Q4', params:'4B', quant:'q4', downloadGb:2.5, residentGb:3.7, thinking:false, stripThink:false, quality:5 },
  { id:'qwen-4b-q8', family:'qwen', tag:'qwen3:4b-instruct-2507-q8_0',   label:'Qwen3 4B · Q8', params:'4B', quant:'q8', downloadGb:4.3, residentGb:5.5, thinking:false, stripThink:false, quality:6 },
  { id:'qwen-8b-q4', family:'qwen', tag:'qwen3:8b-q4_K_M',               label:'Qwen3 8B · Q4', params:'8B', quant:'q4', downloadGb:5.2, residentGb:6.4, thinking:true,  stripThink:true,  quality:7 },
  { id:'qwen-8b-q8', family:'qwen', tag:'qwen3:8b-q8_0',                 label:'Qwen3 8B · Q8', params:'8B', quant:'q8', downloadGb:8.9, residentGb:10.1, thinking:true, stripThink:true,  quality:8 },
  // Gemma 3
  { id:'gemma-4b-q4',  family:'gemma', tag:'gemma3:4b-it-q4_K_M',  label:'Gemma3 4B · Q4',  params:'4B',  quant:'q4', downloadGb:3.3, residentGb:4.5,  thinking:false, stripThink:false, quality:4 },
  { id:'gemma-4b-q8',  family:'gemma', tag:'gemma3:4b-it-q8_0',    label:'Gemma3 4B · Q8',  params:'4B',  quant:'q8', downloadGb:5.0, residentGb:6.2,  thinking:false, stripThink:false, quality:5 },
  { id:'gemma-12b-q4', family:'gemma', tag:'gemma3:12b-it-q4_K_M', label:'Gemma3 12B · Q4', params:'12B', quant:'q4', downloadGb:8.1, residentGb:9.3,  thinking:false, stripThink:false, quality:7 },
  { id:'gemma-12b-q8', family:'gemma', tag:'gemma3:12b-it-q8_0',   label:'Gemma3 12B · Q8', params:'12B', quant:'q8', downloadGb:13.0, residentGb:14.2, thinking:false, stripThink:false, quality:8 },
  // DeepSeek-R1 (1.5B distill: no think toggle, strips <think>; 8B-0528 supports think:false)
  { id:'deepseek-1.5b-q4', family:'deepseek', tag:'deepseek-r1:1.5b-qwen-distill-q4_K_M', label:'DeepSeek-R1 1.5B · Q4', params:'1.5B', quant:'q4', downloadGb:1.1, residentGb:2.3, thinking:false, stripThink:true, quality:2 },
  { id:'deepseek-1.5b-q8', family:'deepseek', tag:'deepseek-r1:1.5b-qwen-distill-q8_0',   label:'DeepSeek-R1 1.5B · Q8', params:'1.5B', quant:'q8', downloadGb:1.9, residentGb:3.1, thinking:false, stripThink:true, quality:3 },
  { id:'deepseek-8b-q4',   family:'deepseek', tag:'deepseek-r1:8b-0528-qwen3-q4_K_M',     label:'DeepSeek-R1 8B · Q4',   params:'8B',   quant:'q4', downloadGb:5.2, residentGb:6.4, thinking:true,  stripThink:true, quality:6 },
  { id:'deepseek-8b-q8',   family:'deepseek', tag:'deepseek-r1:8b-0528-qwen3-q8_0',       label:'DeepSeek-R1 8B · Q8',   params:'8B',   quant:'q8', downloadGb:8.9, residentGb:10.1, thinking:true, stripThink:true, quality:7 },
]
export const WRITER_NUM_CTX = 8192
export function writerById(id: string): WriterModel | undefined
```

## Fit + recommendation — `src/lib/hardware.ts` (add)
```ts
export type Fit = 'fits' | 'tight' | 'no'
export interface WriterFit { fit: Fit; note: string }
export function writerFit(model: WriterModel, hw: HardwareInfo): WriterFit
// headroom for macOS + app + webview = 3 GB. ram = hw.ramGb (0 in the browser → treat as 16 for display, mark source).
//   residentGb <= ram - 3           → 'fits',  note ''
//   residentGb <= ram - 1.5         → 'tight', note 'Tight on {ram} GB: close other apps.'
//   else                            → 'no',    note 'Needs about {ceil(residentGb+3)} GB of memory.'
// Intel (not appleSilicon): any model that fits gets note 'CPU only on Intel: expect a few words per second.'
// (override the empty note; keep the fit value).
export function recommendWriter(hw: HardwareInfo): { id: string; reason: string }
// Among Qwen models with fit 'fits', pick the highest quality. Intel → 'qwen-4b-q4' regardless (if it fits) with reason
// 'Intel Mac: the 4B model keeps writing responsive on the CPU.'; Apple Silicon reasons:
//   8B Q8 → 'Apple Silicon with {ram} GB: room for the full-quality 8B model.'
//   8B Q4 → '{ram} GB: the 8B model at 4-bit is the best balance of quality and memory.'
//   4B Q8/Q4 → '{ram} GB: the 4B model keeps memory free for OCR and the app.'
// Browser fallback (ramGb 0) → 'qwen-4b-q4', reason 'Hardware could not be read: defaulting to the smallest Qwen.'
```

## Settings — `src/lib/settings.ts` (extend, keep the cached-snapshot pattern)
Add `writerId: string | null` and `writerTag: string | null` (defaults null). `writerSkipped: boolean` (default false) so the wizard can show "skipped" vs "not chosen".

## Ollama — `src/lib/ollama.ts` (add)
```ts
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatOptions { think?: boolean; numCtx?: number; temperature?: number; keepAlive?: string }
export async function chatStream(tag: string, messages: ChatMessage[], onToken: (token: string, full: string) => void, opts?: ChatOptions, signal?: AbortSignal): Promise<string>
// POST /api/chat { model, messages, stream: true, options: { num_ctx, temperature }, keep_alive, think? }
// Only include `think` in the body when opts.think !== undefined. NDJSON: each line { message: { content }, done }.
// If the response is 400 and the error text mentions "think", retry once WITHOUT the think field.
// Returns the full assistant text. Aborting resolves with the text so far (do not throw on AbortError).
export function stripThinking(text: string): string   // removes <think>…</think> blocks (also an unterminated leading <think>), trims
export async function unloadModel(tag: string): Promise<void>  // POST /api/generate { model, keep_alive: 0 }; ignore errors
```

## Sources store — `src/lib/sourcesStore.ts` (new; Sources screen moves its state here)
```ts
export function useSources(): Source[]
export function getSources(): Source[]
export function addSource(source: Source): void
export function updateSource(id: string, patch: Partial<Source>): void
export function removeSource(id: string): void
// External store with a cached snapshot (same pattern as settings.ts / paper.ts). Not persisted (files are
// re-added per session for now). The processing queue + AbortControllers stay in the screen, but they
// read/write through this store, and a source keeps processing if the user navigates away
// (move the queue runner into the store module: `enqueue(id, input)` and a module-level runner
// that processes one at a time using readSettings().ocrTag; `cancel(id)` aborts). After the last
// queued OCR finishes, call `unloadModel(ocrTag)` so the writer has the memory.
export function enqueue(id: string, input: SourceInput): void
export function cancel(id: string): void
```

## Writer — `src/lib/writer.ts` (new)
```ts
export interface WriteContext { paperTitle: string; sectionTitle: string; otherSections: { title: string; content: string }[]; sources: { name: string; text: string }[]; intent: string[] /* recent user chat messages */ }
export function buildSectionMessages(ctx: WriteContext): ChatMessage[]
// system: "You are papertiger, an academic writing assistant running fully on this Mac. Write in clear,
//   correct academic English. Use only the source excerpts provided; do not invent citations or numbers.
//   Output plain paragraphs only: no markdown headings, no bullet lists, no preamble, no closing remarks."
// user: title, the section to write, 1-2 sentence summaries (first 300 chars) of other written sections,
//   the user's intent lines, then the source excerpts. Budget: total source text ≤ 9000 characters, split
//   evenly across sources (head of each). If there are no sources, say so and write from the intent only.
export async function writeSection(sectionId: string, signal?: AbortSignal): Promise<void>
// Reads settings.writerTag / writerId (throws Error('No writer model configured') if null), getSources()
// (done sources only), getPaper(), and the last 6 user messages from the chat store (see below).
// Sets section status 'writing', content '' then streams tokens into paper.updateSection (stripThinking
// applied to the running text when model.stripThink), ends with status 'done'. On abort keep the text
// written so far and set status 'done'. On error set status 'done' and rethrow so the UI can show it.
// Options: think:false when model.thinking, numCtx WRITER_NUM_CTX, temperature 0.6, keepAlive '10m'.
```

## Paper store — `src/lib/paper.ts` (change)
`generateSection(id, signal)` becomes: if `readSettings().writerTag` is set → `writeSection(id, signal)`,
else the existing mock stream. Export `isWriterConfigured(): boolean` from settings.ts for the UI.

## Chat store — `src/lib/chat.ts` (new)
```ts
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; streaming?: boolean }
export function useChat(): ChatMessage[]
export function getUserIntent(limit?: number): string[]     // last N user messages' content
export function sendMessage(content: string): Promise<void>
// Appends the user message. If a writer is configured and Ollama is online: streams an assistant reply via
// chatStream with a system prompt ("You are papertiger… You know the paper title, its sections and which
// are still empty, and the user's sources by name. Answer briefly. When the user asks you to write or draft a
// section, reply with one short sentence and the app will draft it in the panel.") + the last 12 messages.
// If the user's message matches /\b(write|draft)\b/i → after the reply starts, call generateSection on the
// first empty section (or the section named in the message if a title matches). Without a writer, keep the
// current canned replies and the mock trigger. Keep the seed messages from src/mock/messages.ts as the
// initial state; `clear()` empties it.
export function clear(): void
```

## Wizard — `src/screens/SetupWizard.tsx` (change)
Steps become: WELCOME · YOUR MAC · OCR · WRITER · DOWNLOAD · DONE.
- **Writer** step: headline "Choose a writer", sub "Optional. You can add or change it later in Settings.",
  tiger `Chip mono` "OPTIONAL" next to the headline. Three family cards (Qwen 3 / Gemma 3 / DeepSeek-R1) with
  the blurb; inside each card a 2×2 grid of variant pills (`4B · Q4`, `4B · Q8`, `8B · Q4`, `8B · Q8`, sized per
  family) showing mono `2.5 GB` under the pill; pill states: selected (tiger fill, ink text), fits (outline),
  tight (outline + amber-ish note using `--ember`), no (disabled, `opacity-40`, tooltip/note "Needs about 9 GB").
  The recommended variant carries a small tiger dot and the reason line shows under the cards. Buttons:
  primary "Use this writer" (disabled until a variant is selected), ghost "Skip for now" → `writerSkipped: true`.
  Re-run the hardware read here only if `hw` is null (reuse the state from step 2).
- **Download** step pulls in order: OCR (if missing) then writer (if chosen and missing). Show a list with one row
  per model: label, then `Chip` "Already on this Mac" / progress bar + mono `x.x GB of y.y GB · nn%` / mint "Ready".
  The active row has the `Stripe`. Cancel aborts the current pull and returns to the WRITER step.
- **Done** summary lists OCR and writer (or "Writer: skipped — add one in Settings").

## Settings — `src/screens/SettingsScreen.tsx` (change)
Writer row: chosen label + mono tag, or "Not set" with "Choose" → `/setup` (the wizard must allow starting at
the WRITER step: support `/setup?step=writer`, which skips to that step and, on finish, returns to `/settings`).

## Sources screen — `src/screens/ReferencesScreen.tsx` (change)
Use `useSources()` / `addSource` / `enqueue` / `cancel` / `removeSource` from the store; drop local source state
and the local queue. UI unchanged.

## Draft + panel + chat (change)
- `EditorScreen`: Generate → `generateSection(activeSection.id, signal)`; show a rose line with the error
  message if it rejects. Add a ghost "Stop" button while writing (aborts).
- `PaperPanel`: unchanged (it already renders `writing`), but show a small mono `writing with Qwen3 4B · Q4`
  under the header while any section is writing when a writer is configured.
- `ChatScreen`: switch to `useChat()` / `sendMessage()` / `clear()`; render streaming assistant text live.
  Empty-state chips stay. If no writer is configured, show a one-line mono hint above the composer:
  "No writer yet — replies are canned. Add one in Settings." with a link to `/setup?step=writer`.

## Verification
`npm run build`, `npm run lint`; for the runtime, this machine has Ollama with `qwen3:4b-instruct-2507-q4_K_M`
already pulled — use it for a real streamed generation in the browser preview.

## Addendum (2026-09-15): voice tunings in the prompt, persisted sources

### Storage — Rust + `src/lib/storage.ts`
Rust commands in `src-tauri/src/lib.rs` (register them):
```rust
#[tauri::command] fn load_app_data(app: tauri::AppHandle, name: String) -> Result<Option<String>, String>
#[tauri::command] fn save_app_data(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String>
// Files live in app.path().app_data_dir()? (create_dir_all) as `<name>.json`; `name` must match ^[a-z0-9-]+$.
// save writes to `<name>.json.tmp` then renames (atomic).
```
```ts
// src/lib/storage.ts
export async function loadJson<T>(name: string): Promise<T | null>      // Tauri: invoke('load_app_data'); browser: localStorage['papertiger.data.'+name]
export async function saveJson(name: string, value: unknown): Promise<void>  // Tauri: invoke('save_app_data'); browser: localStorage (catch quota errors, log a warning)
export function saveJsonDebounced(name: string, getValue: () => unknown, ms = 400): void  // one timer per name
```

### Voice store — `src/lib/voice.ts`
```ts
export interface VoiceTunings { formality: number; conciseness: number; technicality: number }   // 1..10
export const DEFAULT_TUNINGS: VoiceTunings = { formality: 7, conciseness: 6, technicality: 8 }
export function useVoice(): VoiceTunings
export function getVoice(): VoiceTunings
export function setTuning(key: keyof VoiceTunings, value: number): void    // clamps 1..10, saves (debounced) under 'voice'
export function hydrateVoice(): Promise<void>                              // loadJson('voice') → state; call once at app start (main.tsx)
export function describeVoice(t: VoiceTunings): string[]
// maps each 1..10 value to one instruction line, three bands (1-3 / 4-7 / 8-10):
//  formality:    'Use a conversational register; contractions are fine.' | 'Use a measured academic register.' | 'Use a formal academic register; no contractions, no first person.'
//  conciseness:  'Develop points fully with supporting detail.' | 'Keep paragraphs focused; one idea per paragraph.' | 'Be concise: short sentences, no filler, no repetition.'
//  technicality: 'Prefer plain language; explain any technical term.' | 'Use domain terminology where it is precise, briefly defined on first use.' | 'Use precise domain terminology and standard notation without simplification.'
```
`StyleScreen` reads/writes tunings through this store instead of `useState(mockStyleTunings)` (keep `mockStyleTunings` only for name/description/min/max metadata; the value comes from the store). Live preview text stays mock.

### Writer prompt — `src/lib/writer.ts`
`WriteContext` gains `style: string[]`. `buildSectionMessages` adds, after the section line:
```
Style:
- <line>
- <line>
- <line>
```
`writeSection` fills `style: describeVoice(getVoice())`.

### Persisted sources — `src/lib/sources.ts` + `src/lib/sourcesStore.ts`
- `Source` gains `path?: string` (set for Tauri path inputs). `addedAt` serialises as ISO string.
- Store persists under `'sources'` (debounced) on every change: `{ version: 1, sources: PersistedSource[] }` where
  `PersistedSource = { id, name, kind, sizeBytes, addedAt: string, status: 'done' | 'error' | 'queued', pages, text, error?, path? }`.
  In-flight statuses (`rendering`/`extracting`) are saved as `'queued'`.
- `hydrateSources(): Promise<void>` (call once at app start from main.tsx, after `hydrateVoice`): loads, restores `done`/`error` sources as-is; a `queued` source with a `path` is restored and re-enqueued (`enqueue(id, { path })`), one without a path is dropped. Skip hydration if the store already has sources.
- `text` can be large; keep the debounce so a page-by-page OCR run does not write on every token.

### App start — `src/main.tsx`
Before render: `applyTheme(readStoredMode())`, then `void hydrateVoice()`, then `void hydrateSources()` (fire-and-forget; stores notify when loaded).
