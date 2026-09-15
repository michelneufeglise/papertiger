import type { Quant } from './hardware'

export interface OcrModel {
  quant: Quant
  tag: string
  label: string
  downloadGb: number
  residentGb: number
  blurb: string
}

export const OCR_MODELS: Record<Quant, OcrModel> = {
  q8: {
    quant: 'q8',
    tag: 'frob/unlimited-ocr:q8_0',
    label: 'Unlimited-OCR · 8-bit',
    downloadGb: 4.0,
    residentGb: 5.0,
    blurb: 'Full quality. Best on Apple Silicon with 16 GB or more.',
  },
  q4: {
    quant: 'q4',
    tag: 'hf.co/DevQuasar/baidu.Unlimited-OCR-GGUF:Q4_K_M',
    label: 'Unlimited-OCR · 4-bit',
    downloadGb: 2.8,
    residentGb: 3.8,
    blurb: 'Same text accuracy, 1.2 GB less memory. Right for 8 GB Macs and Intel.',
  },
}

export const OCR_NUM_CTX = 8192

/** Ollama lowercases tags on registration (e.g. "...:q4_k_m"); compare case-insensitively. */
export function sameTag(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

// --- Writer catalog ---------------------------------------------------

export type WriterFamily = 'qwen' | 'gemma' | 'deepseek'

export interface WriterModel {
  id: string // e.g. 'qwen-4b-q4'
  family: WriterFamily
  tag: string // exact Ollama tag
  label: string // e.g. 'Qwen3 4B · Q4'
  params: string // '4B' | '8B' | '12B' | '1.5B'
  quant: 'q4' | 'q8'
  downloadGb: number
  residentGb: number // downloadGb + ~1.2 GB KV/overhead at 8K context, rounded to 1 decimal
  thinking: boolean // model can think; we send `think: false`
  stripThink: boolean // distill models emit <think>…</think> inline; strip it
  quality: number // 1..10 ordering for recommendation
}

export const WRITER_FAMILIES: Record<WriterFamily, { name: string; blurb: string }> = {
  qwen: { name: 'Qwen 3', blurb: 'Best all-round academic writer. Strong grammar, multilingual.' },
  gemma: { name: 'Gemma 3', blurb: 'Clear, concise prose. Light on memory.' },
  deepseek: { name: 'DeepSeek-R1', blurb: 'Reasons before it writes. Slower, stronger on argument structure.' },
}

export const WRITER_MODELS: WriterModel[] = [
  // Qwen 3 (instruct 2507 for 4B; 8B is the hybrid thinking model → think:false)
  { id: 'qwen-4b-q4', family: 'qwen', tag: 'qwen3:4b-instruct-2507-q4_K_M', label: 'Qwen3 4B · Q4', params: '4B', quant: 'q4', downloadGb: 2.5, residentGb: 3.7, thinking: false, stripThink: false, quality: 5 },
  { id: 'qwen-4b-q8', family: 'qwen', tag: 'qwen3:4b-instruct-2507-q8_0', label: 'Qwen3 4B · Q8', params: '4B', quant: 'q8', downloadGb: 4.3, residentGb: 5.5, thinking: false, stripThink: false, quality: 6 },
  { id: 'qwen-8b-q4', family: 'qwen', tag: 'qwen3:8b-q4_K_M', label: 'Qwen3 8B · Q4', params: '8B', quant: 'q4', downloadGb: 5.2, residentGb: 6.4, thinking: true, stripThink: true, quality: 7 },
  { id: 'qwen-8b-q8', family: 'qwen', tag: 'qwen3:8b-q8_0', label: 'Qwen3 8B · Q8', params: '8B', quant: 'q8', downloadGb: 8.9, residentGb: 10.1, thinking: true, stripThink: true, quality: 8 },
  // Gemma 3
  { id: 'gemma-4b-q4', family: 'gemma', tag: 'gemma3:4b-it-q4_K_M', label: 'Gemma3 4B · Q4', params: '4B', quant: 'q4', downloadGb: 3.3, residentGb: 4.5, thinking: false, stripThink: false, quality: 4 },
  { id: 'gemma-4b-q8', family: 'gemma', tag: 'gemma3:4b-it-q8_0', label: 'Gemma3 4B · Q8', params: '4B', quant: 'q8', downloadGb: 5.0, residentGb: 6.2, thinking: false, stripThink: false, quality: 5 },
  { id: 'gemma-12b-q4', family: 'gemma', tag: 'gemma3:12b-it-q4_K_M', label: 'Gemma3 12B · Q4', params: '12B', quant: 'q4', downloadGb: 8.1, residentGb: 9.3, thinking: false, stripThink: false, quality: 7 },
  { id: 'gemma-12b-q8', family: 'gemma', tag: 'gemma3:12b-it-q8_0', label: 'Gemma3 12B · Q8', params: '12B', quant: 'q8', downloadGb: 13.0, residentGb: 14.2, thinking: false, stripThink: false, quality: 8 },
  // DeepSeek-R1 (1.5B distill: no think toggle, strips <think>; 8B-0528 supports think:false)
  { id: 'deepseek-1.5b-q4', family: 'deepseek', tag: 'deepseek-r1:1.5b-qwen-distill-q4_K_M', label: 'DeepSeek-R1 1.5B · Q4', params: '1.5B', quant: 'q4', downloadGb: 1.1, residentGb: 2.3, thinking: false, stripThink: true, quality: 2 },
  { id: 'deepseek-1.5b-q8', family: 'deepseek', tag: 'deepseek-r1:1.5b-qwen-distill-q8_0', label: 'DeepSeek-R1 1.5B · Q8', params: '1.5B', quant: 'q8', downloadGb: 1.9, residentGb: 3.1, thinking: false, stripThink: true, quality: 3 },
  { id: 'deepseek-8b-q4', family: 'deepseek', tag: 'deepseek-r1:8b-0528-qwen3-q4_K_M', label: 'DeepSeek-R1 8B · Q4', params: '8B', quant: 'q4', downloadGb: 5.2, residentGb: 6.4, thinking: true, stripThink: true, quality: 6 },
  { id: 'deepseek-8b-q8', family: 'deepseek', tag: 'deepseek-r1:8b-0528-qwen3-q8_0', label: 'DeepSeek-R1 8B · Q8', params: '8B', quant: 'q8', downloadGb: 8.9, residentGb: 10.1, thinking: true, stripThink: true, quality: 7 },
]

export const WRITER_NUM_CTX = 8192

export function writerById(id: string): WriterModel | undefined {
  return WRITER_MODELS.find(m => m.id === id)
}
