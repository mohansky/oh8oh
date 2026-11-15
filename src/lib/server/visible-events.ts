/**
 * The events a visitor may see: scraped events plus approved host
 * submissions, minus anything an admin removed and anything already over.
 *
 * Server-only (talks to the database). Shared by the home page, the calendar
 * and the sitemap so the three can't drift apart.
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { removedEvents, userEvents } from '../../db/schema'
import { hasEventEnded } from '../utils/date-time'
import { generateEventFingerprint } from '../utils/event-fingerprint'
import type { Event } from '../scrapers/types'

export async function withApprovedAndWithoutRemoved(
  scrapedEvents: Array<Event>,
): Promise<Array<Event>> {
  const [approved, removed] = await Promise.all([
    db.select().from(userEvents).where(eq(userEvents.status, 'approved')),
    db.select().from(removedEvents),
  ])

  const submitted: Array<Event> = approved.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    link: event.link,
    description: event.description || '',
    category: event.category || '',
    image: event.image || '',
    venue: event.venue || '',
    price: event.price || '',
    source: 'user-submitted',
  }))

  const removedFingerprints = new Set(removed.map((r) => r.eventFingerprint))

  return [...scrapedEvents, ...submitted].filter(
    (event) =>
      !hasEventEnded(event.date) &&
      !removedFingerprints.has(generateEventFingerprint(event)),
  )
}
