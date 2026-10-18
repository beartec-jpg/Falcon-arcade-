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

/** Live Falcon Ledger portal origins. Always trusted so a stale env value cannot break the embed. */
export const PORTAL_ORIGINS = ['https://falcon-fpl.com', 'https://www.falcon-fpl.com'] as const

/** Old portal domains that no longer serve the API; mapped to the live portal. */
const RETIRED_PORTAL_ORIGINS = ['https://falcon-ledger.com', 'https://www.falcon-ledger.com']

const DEFAULT_PORTAL_API = PORTAL_ORIGINS[0]

function originOf(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

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
  const fromEnv = (import.meta.env.VITE_PARENT_ORIGINS as string | undefined) ?? ''
  const configured = fromEnv
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0 && !RETIRED_PORTAL_ORIGINS.includes(origin))
  const dev = import.meta.env.DEV ? DEFAULT_DEV_PARENT_ORIGINS : []
  // Live portal first so it is the default outbound target.
  return [...new Set<string>([...PORTAL_ORIGINS, ...configured, ...dev])]
}

/** Origin of the page embedding us (ancestorOrigins, else the referrer the portal sends), when trusted. */
export function embedderOrigin(): string | null {
  if (typeof window === 'undefined' || !isInIframe()) return null
  const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
  const candidate = (ancestors && ancestors.length > 0 ? ancestors[0] : null) ?? originOf(document.referrer)
  return candidate && getAllowedParentOrigins().includes(candidate) ? candidate : null
}

/**
 * Base URL for portal APIs (leaderboards). Embedded: the trusted embedding portal.
 * Standalone: VITE_PORTAL_API_URL unless it is a retired domain, else the live portal.
 */
export function portalApiBase(): string {
  const embedded = embedderOrigin()
  if (embedded) return embedded
  const env = originOf(import.meta.env.VITE_PORTAL_API_URL as string | undefined)
  if (env && !RETIRED_PORTAL_ORIGINS.includes(env)) return env
  return DEFAULT_PORTAL_API
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

  const embedded = embedderOrigin()
  if (embedded) {
    return embedded
  }

  const allowed = getAllowedParentOrigins()
  if (allowed.length > 0) {
    return allowed[0]
  }

  return typeof window !== 'undefined' ? window.location.origin : '*'
}
