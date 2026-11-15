# Web scrapers

One scraper per event source. Each exports an object implementing the
`EventScraper` interface in [types.ts](./types.ts) and is registered in the
`scrapers` array in [index.ts](./index.ts).

See [SCRAPERS.md](../../../SCRAPERS.md) for the status of each source.

## Files

- **index.ts** — the registry, and `scrapeAllSources()`, which runs the scrapers
  and de-duplicates their results
- **types.ts** — `Event`, `ScraperResult`, `EventScraper`
- **browser-helper.ts** — `fetchRenderedHTML()`, for pages that need JavaScript
  to render (Cloudflare Browser Rendering through the `BROWSER` binding)

| Scraper | Source | Method |
| --- | --- | --- |
| bic-scraper.ts | Bangalore International Centre | fetch |
| iha-scraper.ts | Indian Heritage Academy | fetch |
| ime-scraper.ts | Indian Music Experience | fetch |
| urbanaut-scraper.ts | Urbanaut | fetch (server-rendered page) |
| total-environment-scraper.ts | Total Environment | JSON API |
| map-scraper.ts | Museum of Art & Photography | browser |
| sabha-scraper.ts | Sabha | browser |
| skillboxes-scraper.ts | Skillboxes | browser |
| district-scraper.ts | District | browser |

## Two kinds of scraper

**Fetch scrapers** download HTML or JSON with `fetch` and parse it with cheerio.
They are quick and run anywhere, including `pnpm dev`.

**Browser scrapers** call `fetchRenderedHTML(env.BROWSER, url, options)`. They
need the `BROWSER` binding, so they only work on Cloudflare (or
`pnpm dev:wrangler`); without the binding the helper returns an empty string and
the scraper should return no events. Give these `priority: 'low'` — low-priority
scrapers run one at a time, each with a 60-second timeout.

Only the scrapers listed in `FAST_SCRAPER_IDS` in [index.ts](./index.ts) run in
the 30-minute background refresh. Everything runs in the daily cron scrape.

## Adding a scraper

```typescript
import * as cheerio from 'cheerio'
import { categorizeEvent } from '../utils/categorize-event'
import { fetchRenderedHTML } from './browser-helper'
import type { EventScraper, ScraperResult } from './types'

export const myScraper: EventScraper = {
  id: 'my-source',
  name: 'My Event Source',
  website: 'https://example.com',
  enabled: true,
  priority: 'low', // 'high' | 'normal' | 'low' — use 'low' for browser scrapers

  scrape: async (env): Promise<ScraperResult> => {
    try {
      const html = await fetchRenderedHTML(env?.BROWSER, 'https://example.com/events')
      if (!html) return { events: [] }

      const $ = cheerio.load(html)
      const events: ScraperResult['events'] = []
      // ... push { title, date, time, link, venue, price, category, source } ...

      return { events, metadata: { totalCount: events.length } }
    } catch (error) {
      console.error('Error scraping My Event Source:', error)
      return { events: [], metadata: { totalCount: 0 } }
    }
  },
}
```

Then add it to the `scrapers` array in [index.ts](./index.ts).

### Dates

`date` is stored as the string you return, and the app decides whether an event
is over by parsing it ([date-time.ts](../utils/date-time.ts)). Return something
it can read, always with a four-digit year:

- a single day: `Sat 14 Nov 2026`, `Saturday, Nov 14 2026`, `November 14, 2026`
- a range: `Nov 10 - Nov 30 2026`

An event whose date can't be parsed is still listed, but only for as long as the
scraper keeps finding it on the source site.
