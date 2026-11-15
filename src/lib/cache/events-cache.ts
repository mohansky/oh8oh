/**
 * Database-backed cache for scraped events
 * Uses database as primary storage with background refresh
 */

import { scrapeAllSources } from '../scrapers'
import {
  getEventStats,
  getLastScraperRun,
  getUpcomingEvents,
  pruneStaleEvents,
  recordScraperRun,
  upsertEvents
} from '../db/events-db'

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes
// A refresh that fails records no scraper run, so the "last run is stale"
// check alone would re-trigger a scrape on every single page load. Remember
// the last attempt (per isolate) and back off between automatic retries.
const RETRY_BACKOFF = 5 * 60 * 1000 // 5 minutes
let lastAutoRefreshAttempt = 0
let isRefreshing = false
let lastRefreshPromise: Promise<void> | null = null

/**
 * Get events from database and trigger background refresh if needed
 * This returns immediately with DB data, then updates in background
 * @param env - Cloudflare Workers env (provides BROWSER binding for JS-rendered pages)
 * @param waitUntil - Cloudflare ExecutionContext.waitUntil; keeps the background
 *   refresh alive after the response returns (Workers cancel floating promises)
 */
export async function getCachedEvents(
  env?: any,
  waitUntil?: (p: Promise<unknown>) => void,
) {
  const now = new Date()

  // Get last scraper run to check freshness
  const lastRun = await getLastScraperRun()
  const needsRefresh = !lastRun ||
    (now.getTime() - lastRun.startedAt.getTime() > REFRESH_INTERVAL)

  // ALWAYS return database events immediately for fast response.
  // Only events that haven't ended yet — past ones are never shown.
  const dbEvents = await getUpcomingEvents()

  // Calculate age
  const age = lastRun
    ? Math.round((now.getTime() - lastRun.startedAt.getTime()) / 1000 / 60)
    : 0

  console.log(`📦 Returning ${dbEvents.length} events from database (${age} minutes old)`)

  // Trigger background refresh if needed (non-blocking)
  // Auto-refresh uses FAST scrapers only (fastOnly: true) to avoid timeouts
  // Slow Puppeteer scrapers run via daily scheduled job at 3 AM
  const recentlyAttempted = now.getTime() - lastAutoRefreshAttempt < RETRY_BACKOFF
  if (needsRefresh && !isRefreshing && !recentlyAttempted) {
    lastAutoRefreshAttempt = now.getTime()
    if (!waitUntil) {
      // On Workers this means the refresh will be cancelled as soon as the
      // response is sent. Harmless in dev, where there is no waitUntil.
      console.warn('⚠️ No waitUntil available — background refresh may be cancelled')
    }
    console.log('🔄 Triggering automatic background refresh (fast scrapers only)...')
    const refreshPromise = refreshEventsInBackground(true, env)
    lastRefreshPromise = refreshPromise
    // Register with the Workers runtime so it isn't cancelled when the
    // response is sent; outside Workers (dev) the promise runs normally.
    if (waitUntil) {
      waitUntil(refreshPromise)
    }
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
export async function forceRefreshEvents(fastOnly: boolean = false, env?: any) {
  console.log(`🔄 Force refresh requested (${fastOnly ? 'fast mode' : 'all scrapers'})`)
  return refreshEventsInBackground(fastOnly, env)
}

/**
 * Background refresh function - scrapes all sources and updates DB
 * @param fastOnly - If true, only run fast scrapers (for manual refresh)
 */
async function refreshEventsInBackground(fastOnly: boolean = false, env?: any) {
  if (isRefreshing) {
    console.log('⏳ Refresh already in progress, waiting...')
    return lastRefreshPromise || Promise.resolve()
  }

  isRefreshing = true

  try {
    console.log(`🚀 Starting ${fastOnly ? 'fast' : 'background'} scrape...`)
    const result = await scrapeAllSources(undefined, fastOnly, env)

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
      // Scraper errors are Error objects, which JSON.stringify turns into {}.
      errors: result.errors.map((e) =>
        e instanceof Error ? e.message : String(e),
      ),
    })

    // Clear out long-finished events on full runs (the daily cron), so the
    // table — which every page load reads in full — doesn't grow forever.
    if (!fastOnly) {
      try {
        const pruned = await pruneStaleEvents()
        console.log(`🧹 Pruned ${pruned} stale events`)
      } catch (error) {
        console.error('Failed to prune stale events:', error)
      }
    }

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
export async function clearCache(env?: any) {
  console.log('🗑️  Clearing cache and forcing refresh...')
  return forceRefreshEvents(false, env)
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
