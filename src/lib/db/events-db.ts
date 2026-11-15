/**
 * Database service layer for events
 * Handles all CRUD operations for events and scraper runs
 */

import { inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../../db'
import { events, scraperRuns } from '../../db/schema'
import { serializeCategories } from '../utils/categorize-event'
import { hasEventEnded } from '../utils/date-time'
import type { Event } from '../scrapers'

/**
 * Generate a stable ID for an event based on its unique characteristics
 * Uses Web Crypto API for Cloudflare Workers compatibility
 */
async function generateEventId(event: Event): Promise<string> {
  // Create a deterministic ID from title, date, and source using SHA-256
  const key = `${event.title}-${event.date}-${event.source}`.toLowerCase()
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 32)
}

/**
 * Generate a random ID using nanoid for Workers compatibility
 */
function generateId(): string {
  return nanoid(32)
}

/**
 * Store events in the database, upserting (insert or update) as needed
 */
export async function upsertEvents(eventsData: Array<Event>): Promise<number> {
  if (eventsData.length === 0) return 0

  const now = new Date()
  let upsertedCount = 0

  const buildUpsert = (eventId: string, event: Event) =>
    db
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

  // Two events in one scrape can hash to the same id (same title/date/source);
  // keep the last so a batch never upserts the same row twice.
  const byId = new Map<string, Event>()
  for (const event of eventsData) {
    byId.set(await generateEventId(event), event)
  }
  const entries = Array.from(byId.entries())

  // One HTTP round trip per chunk instead of one per event. A sequential
  // per-event loop is hundreds of requests, which doesn't fit in the ~30s a
  // Worker gets for waitUntil work and eats into the subrequest limit.
  for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
    const chunk = entries.slice(i, i + UPSERT_BATCH_SIZE)
    const statements = chunk.map(([id, event]) => buildUpsert(id, event))

    try {
      await db.batch(statements as [(typeof statements)[number], ...typeof statements])
      upsertedCount += chunk.length
    } catch (batchError) {
      // A batch is all-or-nothing; retry row by row so one bad event doesn't
      // sink its whole chunk.
      console.error('Batch upsert failed, retrying rows individually:', batchError)
      for (const [id, event] of chunk) {
        try {
          await buildUpsert(id, event)
          upsertedCount++
        } catch (error) {
          console.error(`Failed to upsert event ${event.title}:`, error)
        }
      }
    }
  }

  return upsertedCount
}

const UPSERT_BATCH_SIZE = 50
const DELETE_BATCH_SIZE = 100
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * An event the scrapers have stopped seeing on its source site for this long
 * is treated as gone: cancelled, delisted, or re-listed under a changed title
 * or date (which makes it a new row and would otherwise leave a duplicate).
 * It is also the only way an event with no readable date ("Every Sun",
 * "Check website for dates") ever leaves the list. Every full scrape (daily
 * cron) re-stamps `scrapedAt` on everything still listed, so three days
 * tolerates a couple of failed runs.
 */
const UNSEEN_STALE_DAYS = 3

/** How long after it ends a dated event is kept before being deleted. */
const PRUNE_ENDED_AFTER_DAYS = 7
/** How long any event may go unseen before being deleted. */
const PRUNE_UNSEEN_AFTER_DAYS = 14

/**
 * Get the events worth showing: not yet over, and still being seen on the
 * source site.
 */
export async function getUpcomingEvents(): Promise<Array<Event>> {
  const rows = await db.select().from(events)
  const now = new Date()
  const unseenCutoff = now.getTime() - UNSEEN_STALE_DAYS * DAY_MS

  return rows
    .filter(
      (row) =>
        !hasEventEnded(row.date, now) &&
        row.scrapedAt.getTime() >= unseenCutoff,
    )
    .map((row) => ({
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
 * Delete events that are long gone: ones that ended more than
 * PRUNE_ENDED_AFTER_DAYS ago, and ones the scrapers haven't seen for
 * PRUNE_UNSEEN_AFTER_DAYS. Dates are free-form strings, so this can't be a
 * single SQL filter — rows are judged in JS and deleted by id.
 *
 * Bookmarks keep their own snapshot of the event, so they are unaffected.
 */
export async function pruneStaleEvents(): Promise<number> {
  const rows = await db
    .select({ id: events.id, date: events.date, scrapedAt: events.scrapedAt })
    .from(events)

  const now = new Date()
  const endedCutoff = new Date(now.getTime() - PRUNE_ENDED_AFTER_DAYS * DAY_MS)
  const unseenCutoff = now.getTime() - PRUNE_UNSEEN_AFTER_DAYS * DAY_MS

  const staleIds = rows
    .filter(
      (row) =>
        hasEventEnded(row.date, endedCutoff) ||
        row.scrapedAt.getTime() < unseenCutoff,
    )
    .map((row) => row.id)

  for (let i = 0; i < staleIds.length; i += DELETE_BATCH_SIZE) {
    await db
      .delete(events)
      .where(inArray(events.id, staleIds.slice(i, i + DELETE_BATCH_SIZE)))
  }

  return staleIds.length
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
  errors: Array<any>
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
