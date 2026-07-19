/**
 * iframe / parent-origin helpers for portal embedding.
 */

const DEFAULT_DEV_PARENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
] as const

/**
 * True when this document is running inside a nested browsing context
 * (iframe). Cross-origin parents throw on `window.top` access — treat
 * that as embedded.
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Allowed parent origins for inbound `message` events.
 *
 * Configure with `VITE_PARENT_ORIGINS` (comma-separated).
 * Falls back to common local-dev portal ports when unset.
 */
export function getAllowedParentOrigins(): string[] {
  const fromEnv = import.meta.env.VITE_PARENT_ORIGINS as string | undefined

  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  }

  if (import.meta.env.DEV) {
    return [...DEFAULT_DEV_PARENT_ORIGINS]
  }

  // Production builds without config: no origins are trusted.
  // Set VITE_PARENT_ORIGINS explicitly before shipping embeds.
  return []
}

export function isAllowedParentOrigin(origin: string): boolean {
  if (!origin) {
    return false
  }

  const allowed = getAllowedParentOrigins()

  if (allowed.includes(origin)) {
    return true
  }

  // Same-origin messages (e.g. local harness pages) are accepted.
  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return true
  }

  return false
}

/**
 * Best-effort target origin for outbound `postMessage` calls.
 * Prefer a previously trusted parent origin, then the first configured
 * allow-list entry, then same-origin as a last resort.
 */
export function resolveOutboundTargetOrigin(
  trustedParentOrigin: string | null,
): string {
  if (trustedParentOrigin && isAllowedParentOrigin(trustedParentOrigin)) {
    return trustedParentOrigin
  }

  const allowed = getAllowedParentOrigins()
  if (allowed.length > 0) {
    return allowed[0]
  }

  return typeof window !== 'undefined' ? window.location.origin : '*'
}
