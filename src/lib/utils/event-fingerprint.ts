import { Event } from '../scrapers/types'

/**
 * Simple string hash that produces a URL-safe alphanumeric string.
 * Uses djb2 combined with a secondary hash for low collision rate.
 */
function simpleHash(str: string): string {
  let h1 = 5381
  let h2 = 52711
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = ((h1 << 5) + h1 + ch) >>> 0
    h2 = ((h2 << 5) + h2 + ch) >>> 0
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
}

/**
 * Generate a unique fingerprint for an event
 * Uses title + date + link to create a consistent, URL-safe identifier
 */
export function generateEventFingerprint(event: Event): string {
  const normalizedTitle = event.title.toLowerCase().trim()
  const normalizedDate = event.date.trim()
  const normalizedLink = event.link.toLowerCase().trim()

  const combined = `${normalizedTitle}|${normalizedDate}|${normalizedLink}`
  return simpleHash(combined)
}

/**
 * Generate a SHA-256 hash of the fingerprint (server-side only)
 */
export async function hashEventFingerprint(fingerprint: string): Promise<string> {
  // Use Node.js crypto module (server-side)
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256')
  hash.update(fingerprint)
  return hash.digest('hex')
}

/**
 * Get a unique ID for an event (uses hash on server, fingerprint on client)
 */
export async function getEventId(event: Event): Promise<string> {
  const fingerprint = generateEventFingerprint(event)

  // If we have a user-submitted event with an ID, use that
  if (event.id) {
    return event.id
  }

  // Otherwise, hash the fingerprint
  return await hashEventFingerprint(fingerprint)
}
