// Deterministic hand-drawn rounded-rectangle paths. Pure: no DOM.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SketchOpts {
  /** Spacing between wobble samples along straight edges (px). */
  step?: number
  /** Max perpendicular offset (px). */
  amp?: number
  /** Overshoot past the start point so the stroke does not close (px). */
  overshoot?: number
  /** Global offset applied to the whole path (px). */
  dx?: number
  dy?: number
}

const f = (n: number) => Math.round(n * 10) / 10

/** Smooth 1D value noise: random lattice values, cosine-interpolated. */
function makeNoise(rand: () => number, n: number): (t: number) => number {
  const vals: number[] = []
  for (let i = 0; i <= n + 1; i++) vals.push(rand() * 2 - 1)
  return (t: number) => {
    const i = Math.floor(t)
    const k = t - i
    const s = (1 - Math.cos(k * Math.PI)) / 2
    return vals[i] * (1 - s) + vals[i + 1] * s
  }
}

export function sketchRoundedRect(
  w: number,
  h: number,
  r: number,
  seed: number,
  opts: SketchOpts = {},
): string {
  const { step = 36, amp = 1.2, overshoot = 5, dx = 0, dy = 0 } = opts
  const rand = mulberry32(seed * 7919 + 13)
  const rmax = Math.max(0, Math.min(r, w / 2, h / 2))
  // Corner radii: TL, TR, BR, BL, each +-15%.
  const rad = [0, 1, 2, 3].map(() => rmax * (0.85 + rand() * 0.3))
  const noise = makeNoise(rand, Math.ceil((2 * (w + h)) / step) + 4)
  let tc = 0 // noise cursor, advances along the perimeter
  const adv = (len: number) => {
    tc += len / step
  }

  const parts: string[] = []
  const P = (x: number, y: number) => `${f(x + dx)} ${f(y + dy)}`

  // Edge sampler: from (x0,y0) to (x1,y1), offsetting along unit normal (nx,ny).
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len < 1) return
    const n = Math.max(1, Math.round(len / step))
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const o = i === n ? noise(tc + len / step) * amp : noise(tc + t * (len / step)) * amp
      parts.push(`L${P(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o)}`)
    }
    adv(len)
  }

  const [tl, tr, br, bl] = rad
  // Start slightly past the top-left corner on the top edge.
  const sx = tl + overshoot + 2
  parts.push(`M${P(sx, noise(0) * amp)}`)
  edge(sx, 0, w - tr, 0, 0, 1)
  parts.push(`Q${P(w, 0)} ${P(w, tr)}`)
  edge(w, tr, w, h - br, -1, 0)
  parts.push(`Q${P(w, h)} ${P(w - br, h)}`)
  edge(w - br, h, bl, h, 0, -1)
  parts.push(`Q${P(0, h)} ${P(0, h - bl)}`)
  edge(0, h - bl, 0, tl, 1, 0)
  parts.push(`Q${P(0, 0)} ${P(tl, 0)}`)
  // Overshoot: run past the start point along the top edge.
  parts.push(`L${P(sx + overshoot, noise(tc) * amp + 0.6)}`)
  return parts.join('')
}

/** Lighter second pass: different seed, tiny global offset. */
export function sketchSecondPass(w: number, h: number, r: number, seed: number): string {
  return sketchRoundedRect(w, h, r, seed + 101, { dx: 0.8, dy: 0.6, amp: 1.5, overshoot: 7 })
}
