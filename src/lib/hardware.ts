import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri'
import type { WriterModel } from './models'
import { WRITER_MODELS } from './models'

export interface HardwareInfo {
  chip: string
  appleSilicon: boolean
  ramGb: number
  macosVersion: string
  cpuCores: number
  source: 'tauri' | 'browser'
}

interface RustHardwareInfo {
  chip: string
  apple_silicon: boolean
  ram_gb: number
  macos_version: string
  cpu_cores: number
}

function parseMacosVersionFromUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  const match = navigator.userAgent.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/)
  if (!match) return ''
  return match[1].replace(/_/g, '.')
}

export async function getHardwareInfo(): Promise<HardwareInfo> {
  if (isTauri()) {
    const raw = await invoke<RustHardwareInfo>('hardware_info')
    return {
      chip: raw.chip,
      appleSilicon: raw.apple_silicon,
      ramGb: raw.ram_gb,
      macosVersion: raw.macos_version,
      cpuCores: raw.cpu_cores,
      source: 'tauri',
    }
  }

  return {
    chip: 'Unknown (browser preview)',
    appleSilicon: false,
    ramGb: 0,
    macosVersion: parseMacosVersionFromUserAgent(),
    cpuCores: 0,
    source: 'browser',
  }
}

export type Quant = 'q8' | 'q4'

export interface Recommendation {
  quant: Quant
  reason: string
}

export function recommendQuant(hw: HardwareInfo): Recommendation {
  if (hw.source === 'browser') {
    return {
      quant: 'q4',
      reason: 'Hardware could not be read: defaulting to the smaller 4-bit model.',
    }
  }

  if (hw.appleSilicon && hw.ramGb >= 16) {
    return {
      quant: 'q8',
      reason: `Apple Silicon with ${hw.ramGb} GB: the 8-bit model fits with room to spare and reads a page in seconds.`,
    }
  }

  if (hw.appleSilicon) {
    return {
      quant: 'q4',
      reason: `${hw.ramGb} GB of memory: the 4-bit model leaves room for macOS and the app. Text accuracy is the same.`,
    }
  }

  return {
    quant: 'q4',
    reason: 'Intel Mac: OCR runs on the CPU, so the smaller 4-bit model is the practical choice. Expect a minute or more per page.',
  }
}

// --- Writer fit + recommendation ---------------------------------------

export type Fit = 'fits' | 'tight' | 'no'

export interface WriterFit {
  fit: Fit
  note: string
}

/** ramGb, falling back to 16 for display when it couldn't be read (browser). */
function displayRamGb(hw: HardwareInfo): number {
  return hw.ramGb === 0 ? 16 : hw.ramGb
}

export function writerFit(model: WriterModel, hw: HardwareInfo): WriterFit {
  const ram = displayRamGb(hw)

  let result: WriterFit
  if (model.residentGb <= ram - 3) {
    result = { fit: 'fits', note: '' }
  } else if (model.residentGb <= ram - 1.5) {
    result = { fit: 'tight', note: `Tight on ${ram} GB: close other apps.` }
  } else {
    result = { fit: 'no', note: `Needs about ${Math.ceil(model.residentGb + 3)} GB of memory.` }
  }

  if (result.fit === 'fits' && !hw.appleSilicon && hw.source === 'tauri') {
    return { fit: 'fits', note: 'CPU only on Intel: expect a few words per second.' }
  }

  return result
}

const QWEN_4B_Q4_ID = 'qwen-4b-q4'

export function recommendWriter(hw: HardwareInfo): { id: string; reason: string } {
  if (hw.ramGb === 0) {
    return { id: QWEN_4B_Q4_ID, reason: 'Hardware could not be read: defaulting to the smallest Qwen.' }
  }

  const ram = displayRamGb(hw)

  if (!hw.appleSilicon) {
    return { id: QWEN_4B_Q4_ID, reason: 'Intel Mac: the 4B model keeps writing responsive on the CPU.' }
  }

  const qwenModels = WRITER_MODELS.filter(m => m.family === 'qwen')
  const fitting = qwenModels.filter(m => writerFit(m, hw).fit === 'fits')
  const best = [...fitting].sort((a, b) => b.quality - a.quality)[0]

  if (!best) {
    return { id: QWEN_4B_Q4_ID, reason: `${ram} GB: the 4B model keeps memory free for OCR and the app.` }
  }

  if (best.id === 'qwen-8b-q8') {
    return { id: best.id, reason: `Apple Silicon with ${ram} GB: room for the full-quality 8B model.` }
  }
  if (best.id === 'qwen-8b-q4') {
    return { id: best.id, reason: `${ram} GB: the 8B model at 4-bit is the best balance of quality and memory.` }
  }
  return { id: best.id, reason: `${ram} GB: the 4B model keeps memory free for OCR and the app.` }
}
