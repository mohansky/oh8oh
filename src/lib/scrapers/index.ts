import { deduplicateEvents } from '../utils/deduplicate-events'
import { bicScraper } from './bic-scraper'
import { urbanautScraper } from './urbanaut-scraper'
import { totalEnvironmentScraper } from './total-environment-scraper'
import { sabhaScraper } from './sabha-scraper'
import { mapScraper } from './map-scraper'
import { ihaScraper } from './iha-scraper'
import { skillboxesScraper } from './skillboxes-scraper'
import { imeScraper } from './ime-scraper'
import { districtScraper } from './district-scraper'
import type { Event, EventScraper } from './types'

/**
 * Scraper Registry
 *
 * Add new scrapers here to make them available to the application.
 * Only enabled scrapers will be executed.
 */
export const scrapers: Array<EventScraper> = [
  bicScraper,
  mapScraper,
  sabhaScraper,
  ihaScraper,
  skillboxesScraper,
  totalEnvironmentScraper,
  imeScraper,
  districtScraper,
  urbanautScraper,
  // Add more scrapers here as you implement them
]

/**
 * Get all enabled scrapers
 */
export function getEnabledScrapers(): Array<EventScraper> {
  return scrapers.filter((scraper) => scraper.enabled)
}

/**
 * Callback for incremental loading - called as each scraper completes
 */
export type ScraperProgressCallback = (update: {
  scraperId: string
  events: Array<Event>
  totalProcessed: number
  totalScrapers: number
  priority: 'high' | 'normal' | 'low'
}) => void

/**
 * Fast scrapers that don't use Puppeteer (complete in ~20-30 seconds).
 * NOTE: ids must match each scraper's `id` exactly — IME's id is
 * 'indian-music-experience', not 'ime' (the old 'ime' entry silently never
 * matched, so IME was excluded from fast refreshes).
 */
const FAST_SCRAPER_IDS = ['bic', 'iha', 'indian-music-experience']

/**
 * Run all enabled scrapers with priority handling and deduplicate results
 * High priority scrapers run first, then normal, then low priority scrapers
 *
 * @param onProgress - Optional callback called as each scraper completes (for streaming updates)
 * @param fastOnly - If true, only run fast (non-Puppeteer) scrapers for quick manual refresh
 */
export async function scrapeAllSources(
  onProgress?: ScraperProgressCallback,
  fastOnly: boolean = false,
  env?: any,
) {
  let enabledScrapers = getEnabledScrapers()

  // Filter to fast scrapers only if requested (for manual refresh)
  if (fastOnly) {
    enabledScrapers = enabledScrapers.filter((s) => FAST_SCRAPER_IDS.includes(s.id))
    console.log(`\n⚡ Fast mode: Running ${enabledScrapers.length} fast scrapers only (${enabledScrapers.map((s) => s.id).join(', ')})`)
  }

  // Group scrapers by priority
  const highPriority = enabledScrapers.filter((s) => s.priority === 'high')
  const normalPriority = enabledScrapers.filter((s) => !s.priority || s.priority === 'normal')
  const lowPriority = enabledScrapers.filter((s) => s.priority === 'low')

  const allEvents = []
  const errors = []
  let successCount = 0
  let processedCount = 0

  // Run high priority scrapers first
  if (highPriority.length > 0) {
    console.log(`\n🚀 Running ${highPriority.length} high priority scraper(s)...`)
    const results = await Promise.allSettled(
      highPriority.map((scraper) =>
        scraper.scrape(env).then((result) => ({
          scraper: scraper.id,
          ...result,
        })),
      ),
    )

    for (const result of results) {
      processedCount++
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value.events)
        successCount++

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            scraperId: result.value.scraper,
            events: result.value.events,
            totalProcessed: processedCount,
            totalScrapers: enabledScrapers.length,
            priority: 'high',
          })
        }
      } else {
        errors.push(result.reason)
        console.error('Scraper error:', result.reason)
      }
    }
  }

  // Run normal priority scrapers
  if (normalPriority.length > 0) {
    console.log(`\n⚡ Running ${normalPriority.length} normal priority scraper(s)...`)
    const results = await Promise.allSettled(
      normalPriority.map((scraper) =>
        scraper.scrape(env).then((result) => ({
          scraper: scraper.id,
          ...result,
        })),
      ),
    )

    for (const result of results) {
      processedCount++
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value.events)
        successCount++

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            scraperId: result.value.scraper,
            events: result.value.events,
            totalProcessed: processedCount,
            totalScrapers: enabledScrapers.length,
            priority: 'normal',
          })
        }
      } else {
        errors.push(result.reason)
        console.error('Scraper error:', result.reason)
      }
    }
  }

  // Run low priority scrapers last (SEQUENTIALLY to avoid Puppeteer conflicts)
  if (lowPriority.length > 0) {
    console.log(`\n🐢 Running ${lowPriority.length} low priority scraper(s) sequentially...`)
    console.log('   (Puppeteer scrapers run one at a time to prevent conflicts)\n')

    // Run scrapers one at a time instead of in parallel
    for (const scraper of lowPriority) {
      processedCount++
      console.log(`   🔄 [${processedCount}/${enabledScrapers.length}] Scraping ${scraper.name}...`)

      try {
        // Add timeout to prevent individual scrapers from hanging forever
        const timeoutMs = 60000 // 60 second timeout per scraper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        })

        const result = await Promise.race([
          scraper.scrape(env),
          timeoutPromise
        ])

        allEvents.push(...result.events)
        successCount++

        console.log(`   ✅ ${scraper.name}: Found ${result.events.length} events`)

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            scraperId: scraper.id,
            events: result.events,
            totalProcessed: processedCount,
            totalScrapers: enabledScrapers.length,
            priority: 'low',
          })
        }
      } catch (error) {
        errors.push(error)
        console.error(`   ❌ ${scraper.name} failed:`, error instanceof Error ? error.message : String(error))
      }
    }
  }

  // Deduplicate events from multiple sources, merging their information
  const deduplicatedEvents = deduplicateEvents(allEvents)

  return {
    events: deduplicatedEvents,
    totalScrapers: enabledScrapers.length,
    successCount,
    errorCount: errors.length,
    errors,
    originalEventCount: allEvents.length,
    deduplicatedEventCount: deduplicatedEvents.length,
  }
}

// Re-export types for convenience
export type { Event, ScraperResult, EventScraper } from './types'
