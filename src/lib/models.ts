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
