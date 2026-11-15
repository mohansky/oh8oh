import type { EventScraper, ScraperResult } from './types'

/**
 * Creates a placeholder scraper for websites that require special handling
 * (e.g., JavaScript-rendered sites, sites requiring authentication, API-based sites)
 *
 * This serves as a template for future implementation
 */
export function createPlaceholderScraper(
  id: string,
  name: string,
  website: string,
  _message: string = 'This scraper is not yet implemented',
): EventScraper {
  return {
    id,
    name,
    website,
    enabled: false,

    scrape: async (): Promise<ScraperResult> => {
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    },
  }
}

// Example placeholder for Urbanaut
export const urbanaAutScraper: EventScraper = {
  ...createPlaceholderScraper(
    'urbanaut',
    'Urbanaut',
    'https://urbanaut.app',
    'This site is JavaScript-rendered and requires a headless browser or API access. Consider using Puppeteer or their API if available.',
  ),
  enabled: false, // Temporarily disabled for testing
}
