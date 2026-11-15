import { Event } from '../scrapers/types'

/**
 * Generate a unique fingerprint for an event
 * Uses title + date + link to create a consistent identifier
 */
export function generateEventFingerprint(event: Event): string {
  // Normalize the data to ensure consistency
  const normalizedTitle = event.title.toLowerCase().trim()
  const normalizedDate = event.date.trim()
  const normalizedLink = event.link.toLowerCase().trim()

  // Combine the key fields
  const combined = `${normalizedTitle}|${normalizedDate}|${normalizedLink}`

  // Create a simple hash (for server-side, we'll use crypto)
  return combined
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
