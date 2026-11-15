/**
 * Database service layer for events
 * Handles all CRUD operations for events and scraper runs
 */

import { sql } from 'drizzle-orm'
import { db } from '../../db'
import { events, scraperRuns } from '../../db/schema'
import type { Event } from '../scrapers'
import { createHash, randomBytes } from 'crypto'
import { serializeCategories } from '../utils/categorize-event'

/**
 * Generate a stable ID for an event based on its unique characteristics
 */
function generateEventId(event: Event): string {
  // Create a deterministic ID from title, date, and source using SHA-256
  const key = `${event.title}-${event.date}-${event.source}`.toLowerCase()
  return createHash('sha256').update(key).digest('hex').substring(0, 32)
}

/**
 * Generate a random ID
 */
function generateId(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Store events in the database, upserting (insert or update) as needed
 */
export async function upsertEvents(eventsData: Event[]): Promise<number> {
  if (eventsData.length === 0) return 0

  const now = new Date()
  let upsertedCount = 0

  for (const event of eventsData) {
    const eventId = generateEventId(event)

    try {
      // Try to insert, or update if it already exists
      await db
        .insert(events)
        .values({
          id: eventId,
          title: event.title,
          date: event.date,
          time: event.time,
          link: event.link,
          description: event.description ?? null,
          category: serializeCategories(event.category) ?? null,
          image: event.image ?? null,
          venue: event.venue ?? null,
          price: event.price ?? null,
          source: event.source,
          createdAt: now,
          updatedAt: now,
          scrapedAt: now,
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            title: event.title,
            date: event.date,
            time: event.time,
            link: event.link,
            description: event.description ?? null,
            category: serializeCategories(event.category) ?? null,
            image: event.image ?? null,
            venue: event.venue ?? null,
            price: event.price ?? null,
            updatedAt: now,
            scrapedAt: now,
          },
        })

      upsertedCount++
    } catch (error) {
      console.error(`Failed to upsert event ${event.title}:`, error)
    }
  }

  return upsertedCount
}

/**
 * Get all events from the database
 */
export async function getAllEvents(): Promise<Event[]> {
  const rows = await db.select().from(events)

  return rows.map((row) => ({
    title: row.title,
    date: row.date,
    time: row.time,
    link: row.link,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    image: row.image ?? undefined,
    venue: row.venue ?? undefined,
    price: row.price ?? undefined,
    source: row.source,
  }))
}

/**
 * Get events scraped after a certain date (for freshness checks)
 */
export async function getRecentEvents(since: Date): Promise<Event[]> {
  const rows = await db
    .select()
    .from(events)
    .where(sql`${events.scrapedAt} >= ${since.getTime()}`)

  return rows.map((row) => ({
    title: row.title,
    date: row.date,
    time: row.time,
    link: row.link,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    image: row.image ?? undefined,
    venue: row.venue ?? undefined,
    price: row.price ?? undefined,
    source: row.source,
  }))
}

/**
 * Delete events older than a certain date
 * (useful for cleaning up past events)
 */
export async function deleteOldEvents(beforeDate: string): Promise<number> {
  const result = await db
    .delete(events)
    .where(sql`${events.date} < ${beforeDate}`)

  return result.changes
}

/**
 * Record a scraper run in the database
 */
export async function recordScraperRun(runData: {
  totalScrapers: number
  successCount: number
  errorCount: number
  originalEventCount: number
  deduplicatedEventCount: number
  errors: any[]
}): Promise<string> {
  const runId = generateId()
  const now = new Date()

  await db.insert(scraperRuns).values({
    id: runId,
    startedAt: now,
    completedAt: now,
    totalScrapers: runData.totalScrapers,
    successCount: runData.successCount,
    errorCount: runData.errorCount,
    originalEventCount: runData.originalEventCount,
    deduplicatedEventCount: runData.deduplicatedEventCount,
    errors: JSON.stringify(runData.errors),
  })

  return runId
}

/**
 * Get the last scraper run info
 */
export async function getLastScraperRun() {
  const runs = await db
    .select()
    .from(scraperRuns)
    .orderBy(sql`${scraperRuns.startedAt} DESC`)
    .limit(1)

  if (runs.length === 0) return null

  const run = runs[0]
  return {
    ...run,
    errors: run.errors ? JSON.parse(run.errors) : [],
  }
}

/**
 * Get statistics about stored events
 */
export async function getEventStats() {
  const totalEvents = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)

  const uniqueSources = await db
    .select({ source: events.source })
    .from(events)
    .groupBy(events.source)

  const lastRun = await getLastScraperRun()

  return {
    totalEvents: totalEvents[0]?.count ?? 0,
    uniqueSources: uniqueSources.length,
    sources: uniqueSources.map((s) => s.source),
    lastScraperRun: lastRun,
  }
}
