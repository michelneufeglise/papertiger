import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri'

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
