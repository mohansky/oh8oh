/**
 * Database-backed cache for scraped events
 * Uses database as primary storage with background refresh
 */

import { scrapeAllSources } from '../scrapers'
import {
  getAllEvents,
  upsertEvents,
  recordScraperRun,
  getLastScraperRun,
  getEventStats
} from '../db/events-db'

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes
let isRefreshing = false
let lastRefreshPromise: Promise<void> | null = null

/**
 * Get events from database and trigger background refresh if needed
 * This returns immediately with DB data, then updates in background
 */
export async function getCachedEvents() {
  const now = new Date()

  // Get last scraper run to check freshness
  const lastRun = await getLastScraperRun()
  const needsRefresh = !lastRun ||
    (now.getTime() - lastRun.startedAt.getTime() > REFRESH_INTERVAL)

  // ALWAYS return database events immediately for fast response
  const dbEvents = await getAllEvents()

  // Calculate age
  const age = lastRun
    ? Math.round((now.getTime() - lastRun.startedAt.getTime()) / 1000 / 60)
    : 0

  console.log(`📦 Returning ${dbEvents.length} events from database (${age} minutes old)`)

  // Trigger background refresh if needed (non-blocking)
  // Auto-refresh uses FAST scrapers only (fastOnly: true) to avoid timeouts
  // Slow Puppeteer scrapers run via daily scheduled job at 3 AM
  if (needsRefresh && !isRefreshing) {
    console.log('🔄 Triggering automatic background refresh (fast scrapers only)...')
    lastRefreshPromise = refreshEventsInBackground(true)
  }

  return {
    events: dbEvents,
    totalScrapers: lastRun?.totalScrapers ?? 0,
    successCount: lastRun?.successCount ?? 0,
    errorCount: lastRun?.errorCount ?? 0,
    cached: true,
    cacheAge: age,
    isRefreshing,
    originalEventCount: lastRun?.originalEventCount ?? dbEvents.length,
    deduplicatedEventCount: lastRun?.deduplicatedEventCount ?? dbEvents.length,
  }
}

/**
 * Force a refresh of events (scrape all sources and update DB)
 * @param fastOnly - If true, only run fast scrapers (for manual refresh)
 */
export async function forceRefreshEvents(fastOnly: boolean = false) {
  console.log(`🔄 Force refresh requested (${fastOnly ? 'fast mode' : 'all scrapers'})`)
  return refreshEventsInBackground(fastOnly)
}

/**
 * Background refresh function - scrapes all sources and updates DB
 * @param fastOnly - If true, only run fast scrapers (for manual refresh)
 */
async function refreshEventsInBackground(fastOnly: boolean = false) {
  if (isRefreshing) {
    console.log('⏳ Refresh already in progress, waiting...')
    return lastRefreshPromise || Promise.resolve()
  }

  isRefreshing = true

  try {
    console.log(`🚀 Starting ${fastOnly ? 'fast' : 'background'} scrape...`)
    const result = await scrapeAllSources(undefined, fastOnly)

    // Store events in database
    console.log(`💾 Storing ${result.deduplicatedEventCount} events in database...`)
    await upsertEvents(result.events)

    // Record scraper run
    await recordScraperRun({
      totalScrapers: result.totalScrapers,
      successCount: result.successCount,
      errorCount: result.errorCount,
      originalEventCount: result.originalEventCount,
      deduplicatedEventCount: result.deduplicatedEventCount,
      errors: result.errors || [],
    })

    console.log('✅ Background refresh completed successfully')
  } catch (error) {
    console.error('❌ Background refresh failed:', error)
  } finally {
    isRefreshing = false
    lastRefreshPromise = null
  }
}

/**
 * Manually clear the cache and trigger fresh scrape
 */
export async function clearCache() {
  console.log('🗑️  Clearing cache and forcing refresh...')
  return forceRefreshEvents()
}

/**
 * Get cache status without fetching
 */
export async function getCacheStatus() {
  const lastRun = await getLastScraperRun()
  const stats = await getEventStats()

  if (!lastRun) {
    return {
      exists: false,
      age: 0,
      stats,
    }
  }

  const age = Math.round((Date.now() - lastRun.startedAt.getTime()) / 1000 / 60)
  const isStale = Date.now() - lastRun.startedAt.getTime() >= REFRESH_INTERVAL

  return {
    exists: true,
    age,
    isStale,
    ttl: REFRESH_INTERVAL / 1000 / 60, // in minutes
    lastRun,
    stats,
    isRefreshing,
  }
}
