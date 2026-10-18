import Phaser from 'phaser'

/**
 * Shared arcade colour language.
 *  FRIENDLY  = gold / green, rounded, white symbol, soft glow + pulse.
 *  DANGER    = red / orange, angular, warning stripes, hard outline, no glow.
 */
export const ART = {
  danger: 0xef4444,
  dangerDeep: 0x991b1b,
  warn: 0xf97316,
  warnBright: 0xfdba74,
  stripeDark: 0x1c0a0a,
  outline: 0x0b1224,
  slate: 0x1e293b,
  slateLight: 0x334155,
  gold: 0xf0c14a,
  goldDeep: 0xd4922a,
  green: 0x22c55e,
  greenDeep: 0x15803d,
  white: 0xffffff,
  cream: 0xfef3c7,
} as const

type V = { x: number; y: number }

/** Clip a convex polygon to an axis-aligned rect (Sutherland–Hodgman). */
function clipToRect(poly: V[], x0: number, y0: number, x1: number, y1: number): V[] {
  const edges: [(p: V) => boolean, (a: V, b: V) => V][] = [
    [(p) => p.x >= x0, (a, b) => ({ x: x0, y: a.y + ((b.y - a.y) * (x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= x1, (a, b) => ({ x: x1, y: a.y + ((b.y - a.y) * (x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (y0 - a.y)) / (b.y - a.y), y: y0 })],
    [(p) => p.y <= y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (y1 - a.y)) / (b.y - a.y), y: y1 })],
  ]
  let out = poly
  for (const [inside, cut] of edges) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur))
        out.push(cur)
      } else if (inside(prev)) {
        out.push(cut(prev, cur))
      }
    }
    if (!out.length) break
  }
  return out
}

/** Diagonal orange/dark warning stripes filling a rect. */
export function warningStripes(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  band = 8,
  light: number = ART.warn,
  dark: number = ART.stripeDark,
) {
  g.fillStyle(dark, 1)
  g.fillRect(x, y, w, h)
  g.fillStyle(light, 1)
  for (let i = -h; i < w + h; i += band * 2) {
    const x0 = x + i
    const quad: V[] = [
      { x: x0, y: y + h },
      { x: x0 + band, y: y + h },
      { x: x0 + band + h, y },
      { x: x0 + h, y },
    ]
    const clipped = clipToRect(quad, x, y, x + w, y + h)
    if (clipped.length >= 3) g.fillPoints(clipped, true)
  }
}

export type BadgeSymbol = 'star' | 'plus' | 'shield' | 'diamond' | 'up'

/**
 * Friendly pickup badge: soft glow, rounded-square gold/green body,
 * white rim and a big white symbol. Drawn at `k`× for crisp scaling.
 */
export function drawBadge(
  g: Phaser.GameObjects.Graphics,
  size: number,
  symbol: BadgeSymbol,
  fill: number = ART.gold,
  fillDeep: number = ART.goldDeep,
) {
  const c = size / 2
  const body = size * 0.68
  const r = body * 0.3
  // outer soft glow (friendly only)
  g.fillStyle(fill, 0.16)
  g.fillCircle(c, c, size * 0.5)
  g.fillStyle(fill, 0.22)
  g.fillCircle(c, c, size * 0.42)
  // body
  const x = c - body / 2
  g.fillStyle(fillDeep, 1)
  g.fillRoundedRect(x, x + body * 0.05, body, body, r)
  g.fillStyle(fill, 1)
  g.fillRoundedRect(x, x, body, body * 0.95, r)
  g.lineStyle(Math.max(2, size * 0.05), ART.white, 0.95)
  g.strokeRoundedRect(x, x, body, body, r)
  // symbol
  g.fillStyle(ART.white, 1)
  const s = body * 0.36
  switch (symbol) {
    case 'star': {
      const pts: Phaser.Types.Math.Vector2Like[] = []
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 === 0 ? s : s * 0.45
        pts.push({ x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr })
      }
      g.fillPoints(pts, true)
      break
    }
    case 'plus': {
      const t = s * 0.42
      g.fillRect(c - s, c - t / 2, s * 2, t)
      g.fillRect(c - t / 2, c - s, t, s * 2)
      break
    }
    case 'shield': {
      g.fillPoints(
        [
          { x: c, y: c - s },
          { x: c + s * 0.85, y: c - s * 0.6 },
          { x: c + s * 0.7, y: c + s * 0.35 },
          { x: c, y: c + s },
          { x: c - s * 0.7, y: c + s * 0.35 },
          { x: c - s * 0.85, y: c - s * 0.6 },
        ],
        true,
      )
      break
    }
    case 'diamond': {
      g.fillPoints(
        [
          { x: c, y: c - s },
          { x: c + s * 0.75, y: c },
          { x: c, y: c + s },
          { x: c - s * 0.75, y: c },
        ],
        true,
      )
      break
    }
    case 'up': {
      g.fillTriangle(c, c - s, c + s * 0.85, c + s * 0.15, c - s * 0.85, c + s * 0.15)
      g.fillRect(c - s * 0.3, c + s * 0.1, s * 0.6, s * 0.85)
      break
    }
  }
}

/** Spiky red mine (hazard): 8 angular spikes, dark core, red/white rim, no glow. */
export function drawSpikyMine(g: Phaser.GameObjects.Graphics, size: number) {
  const c = size / 2
  const outer = size * 0.48
  const inner = size * 0.3
  const pts: Phaser.Types.Math.Vector2Like[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8
    const rr = i % 2 === 0 ? outer : inner
    pts.push({ x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr })
  }
  g.fillStyle(ART.danger, 1)
  g.fillPoints(pts, true)
  g.lineStyle(Math.max(1.5, size * 0.04), ART.outline, 1)
  g.strokePoints(pts, true, true)
  g.fillStyle(ART.dangerDeep, 1)
  g.fillCircle(c, c, inner * 0.95)
  g.lineStyle(Math.max(1.5, size * 0.045), 0xfee2e2, 1)
  g.strokeCircle(c, c, inner * 0.95)
  // warning "!" core
  g.fillStyle(ART.warnBright, 1)
  g.fillRect(c - size * 0.035, c - inner * 0.55, size * 0.07, inner * 0.7)
  g.fillCircle(c, c + inner * 0.42, size * 0.04)
}

/** Angular red/orange slab with warning stripes and a hard outline. */
export function drawStripedSlab(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  opts: { stripeEnds?: boolean; fill?: number; band?: number } = {},
) {
  const fill = opts.fill ?? ART.slate
  g.fillStyle(fill, 1)
  g.fillRect(0, 0, w, h)
  const band = opts.band ?? Math.min(18, Math.max(8, Math.round(Math.min(w, h) * 0.22)))
  if (opts.stripeEnds) {
    warningStripes(g, 0, 0, w, band, Math.max(4, band * 0.5))
    warningStripes(g, 0, h - band, w, band, Math.max(4, band * 0.5))
  } else {
    warningStripes(g, 0, 0, w, h, Math.max(4, Math.min(w, h) * 0.18))
  }
  g.lineStyle(2, ART.danger, 1)
  g.strokeRect(1, 1, w - 2, h - 2)
}
