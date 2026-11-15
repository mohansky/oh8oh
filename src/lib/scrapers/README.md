# Web Scrapers

This directory contains web scrapers for various event sources in Bangalore.

## Browser Rendering Migration

**⚠️ IMPORTANT:** All scrapers now use **Cloudflare Browser Rendering API** instead of Puppeteer.

Puppeteer does not work on Cloudflare Workers, so we've migrated to Cloudflare's managed browser service.

### Quick Start

**Old way (Puppeteer - doesn't work on Workers):**
```typescript
import { fetchRenderedHTML } from './puppeteer-helper'

const html = await fetchRenderedHTML(url)
```

**New way (Cloudflare Browser Rendering):**
```typescript
import { setBrowserBinding, fetchRenderedHTML } from './puppeteer-helper'

// At the start of your scraper function
setBrowserBinding(env.BROWSER)

// Then use as normal
const html = await fetchRenderedHTML(url)
```

**Or use the new helper directly:**
```typescript
import { fetchRenderedHTML } from './browser-helper'

const html = await fetchRenderedHTML(env.BROWSER, url, options)
```

## Files

### Core Files
- **browser-helper.ts** - New Cloudflare Browser Rendering implementation
- **puppeteer-helper.ts** - Backward-compatible wrapper (DEPRECATED)
- **types.ts** - Shared TypeScript types for scrapers

### Scrapers
Each scraper exports an object implementing the `EventScraper` interface:

- **bic-scraper.ts** - Bangalore International Centre (fetch)
- **iha-scraper.ts** - Indian Heritage Academy (fetch)
- **ime-scraper.ts** - Indian Music Experience (fetch)
- **map-scraper.ts** - MAP / Museum of Art & Photography (Puppeteer)
- **skillboxes-scraper.ts** - Skillboxes workshops (Puppeteer)
- **urbanaut-scraper.ts** - Urbanaut events (fetch, SSR)
- **district-scraper.ts** - District events (Puppeteer)
- **total-environment-scraper.ts** - Total Environment music events (JSON API)
- **sabha-scraper.ts** - Sabha cultural events (Puppeteer)

See [SCRAPERS.md](../../../SCRAPERS.md) for per-scraper status.

## Creating a New Scraper

See [BROWSER_RENDERING.md](../../../BROWSER_RENDERING.md) for complete documentation.

Basic template:

```typescript
import { EventScraper, ScraperResult } from './types'
import { setBrowserBinding, fetchRenderedHTML } from './puppeteer-helper'
import * as cheerio from 'cheerio'

export const myNewScraper: EventScraper = {
  id: 'my-source',
  name: 'My Event Source',
  website: 'https://example.com',
  enabled: true,
  priority: 'medium',

  scrape: async (env): Promise<ScraperResult> => {
    try {
      // IMPORTANT: Set browser binding first!
      setBrowserBinding(env.BROWSER)

      // Fetch rendered HTML
      const html = await fetchRenderedHTML('https://example.com/events')

      // Parse and extract events...
      const $ = cheerio.load(html)
      // ... scraping logic

      return { events, metadata: { totalCount: events.length } }
    } catch (error) {
      console.error('Scraper error:', error)
      return { events: [], metadata: { totalCount: 0 } }
    }
  },
}
```

## Resources

- [Cloudflare Browser Rendering Guide](../../../BROWSER_RENDERING.md)
- [Migration Checklist](../../../MIGRATION_CHECKLIST.md)
- [Deployment Guide](../../../DEPLOYMENT.md)
