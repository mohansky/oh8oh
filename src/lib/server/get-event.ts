import { createServerFn } from '@tanstack/react-start'
import type { Event } from '../scrapers'

// Server function to get a single event by fingerprint
export const getEventByFingerprint = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<Event | null> => {
  const fingerprint = ctx.data as string

  const { db } = await import('../../db')
  const { events, userEvents } = await import('../../db/schema')
  const { eq } = await import('drizzle-orm')
  const { generateEventFingerprint } = await import('../utils/event-fingerprint')

  // First check scraped events
  const allEvents = await db.select().from(events)

  for (const event of allEvents) {
    const eventData: Event = {
      title: event.title,
      date: event.date,
      time: event.time || '',
      link: event.link,
      description: event.description || '',
      category: event.category || '',
      image: event.image || '',
      venue: event.venue || '',
      price: event.price || '',
      source: event.source,
    }

    if (generateEventFingerprint(eventData) === fingerprint) {
      return eventData
    }
  }

  // Check user-submitted events
  const userEventsList = await db
    .select()
    .from(userEvents)
    .where(eq(userEvents.status, 'approved'))

  for (const event of userEventsList) {
    const eventData: Event = {
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time || '',
      link: event.link,
      description: event.description || '',
      category: event.category || '',
      image: event.image || '',
      venue: event.venue || '',
      price: event.price || '',
      source: 'user-submitted',
    }

    if (generateEventFingerprint(eventData) === fingerprint) {
      return eventData
    }
  }

  return null
})
