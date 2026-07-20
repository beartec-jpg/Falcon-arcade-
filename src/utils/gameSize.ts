/**
 * Pick a logical Phaser resolution that matches the host aspect ratio.
 * Avoids letterboxing (black bars) without stretching sprites.
 */

export type LogicalSize = { width: number; height: number }

/** Coarse buckets so we don't thrash resize on tiny layout shifts. */
export type AspectBucket = 'portrait-tall' | 'portrait' | 'square' | 'landscape'

/**
 * Multiplier on base design resolutions.
 * >1 = more world units on screen (sprites look smaller = “zoomed out”).
 * Fixes cramped play on Flight / Runner / Amendment Apocalypse when the
 * canvas FIT-scales a small logical size up to a large host.
 */
export const LOGICAL_ZOOM_OUT = 1.22

export function aspectBucket(aspect: number): AspectBucket {
  if (aspect < 0.72) return 'portrait-tall' // ~9:16 phones
  if (aspect < 0.95) return 'portrait' // ~3:4
  if (aspect < 1.25) return 'square'
  return 'landscape' // ~16:9
}

function scaledSize(width: number, height: number): LogicalSize {
  return {
    width: Math.round(width * LOGICAL_ZOOM_OUT),
    height: Math.round(height * LOGICAL_ZOOM_OUT),
  }
}

/**
 * Logical design sizes (not CSS pixels). Games read this.scale.width/height
 * so playfields expand into the extra vertical/horizontal room.
 */
export function logicalSizeForBucket(bucket: AspectBucket): LogicalSize {
  switch (bucket) {
    case 'portrait-tall':
      return scaledSize(540, 960) // 9:16
    case 'portrait':
      return scaledSize(600, 900) // 2:3
    case 'square':
      return scaledSize(800, 720)
    case 'landscape':
    default:
      return scaledSize(960, 540) // 16:9
  }
}

export function measureHostSize(parent: HTMLElement): LogicalSize {
  const w = Math.max(1, parent.clientWidth || parent.offsetWidth || 960)
  const h = Math.max(1, parent.clientHeight || parent.offsetHeight || 540)
  return { width: w, height: h }
}

export function resolveLogicalSize(parent: HTMLElement): {
  size: LogicalSize
  bucket: AspectBucket
} {
  const host = measureHostSize(parent)
  const aspect = host.width / host.height
  const bucket = aspectBucket(aspect)
  return { size: logicalSizeForBucket(bucket), bucket }
}
