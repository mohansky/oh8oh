import * as cheerio from 'cheerio'
import { categorizeEvent } from '../utils/categorize-event'
import { MONTH_MAP, inferEventYear } from '../utils/date-time'
import type { EventScraper, ScraperResult } from './types'

/**
 * Urbanaut is an Angular Universal app — its event listing is server-rendered,
 * so we can scrape it with a plain fetch (no Puppeteer/BROWSER binding needed).
 * Titles/dates/venues/prices/links are all in the SSR HTML.
 *
 * Limitation: card images are lazy-loaded client-side (the SSR `src` is a
 * `loading.svg` placeholder), so no event image is available via direct fetch.
 */
export const urbanautScraper: EventScraper = {
  id: 'urbanaut',
  name: 'Urbanaut',
  website: 'https://urbanaut.app',
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const events: ScraperResult['events'] = []
      const url = 'https://urbanaut.app/experience-bengaluru/events'
      console.log(`🎪 Fetching Urbanaut events from ${url}...`)

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (!response.ok) {
        console.log(`Urbanaut: HTTP ${response.status}`)
        return { events: [] }
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const $eventCards = $('app-spot-card[type="explore"]')
      console.log(`Urbanaut: Found ${$eventCards.length} event cards`)

      const seenLinks = new Set<string>()

      $eventCards.each((_, element) => {
        const $card = $(element)

        // Title + link
        const $titleLink = $card.find('a.title-link').first()
        const title = $titleLink.find('.pre-wrap').text().trim()
        let link = $titleLink.attr('href') || ''

        if (!title || title.length < 3 || !link) return

        if (!link.startsWith('http')) {
          link = link.startsWith('/')
            ? `https://urbanaut.app${link}`
            : `https://urbanaut.app/${link}`
        }

        if (seenLinks.has(link)) return
        seenLinks.add(link)

        // Date and venue are both rendered as <span class="date-time"> — the
        // first (inside .date-info) is the date, the second is the venue.
        const dateTimes = $card
          .find('span.date-time')
          .map((_i, s) => $(s).text().trim())
          .get()
          .filter(Boolean)
        let date = dateTimes[0] || ''
        const venue = dateTimes[1] || 'Check event website'

        // Add a year to dates like "Saturday, Jul 18" (Urbanaut omits it)
        // The year goes on the end, so for a range ("Oct 18 - Dec 20") it is
        // the END date's year that has to be right — infer from the last
        // "Mon DD" in the string.
        if (date && !/\d{4}/.test(date)) {
          const monthDays = [
            ...date.matchAll(
              /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/gi,
            ),
          ]
          const last = monthDays.at(-1)
          if (last) {
            const monthNum = MONTH_MAP[last[1].toLowerCase()]
            date = `${date} ${inferEventYear(monthNum, parseInt(last[2]))}`
          }
        }

        // Price
        let price = $card.find('.price-text').first().text().trim()
        if (!price) price = 'Check website for price'

        events.push({
          title,
          date: date || 'Check website for dates',
          time: 'Time TBA',
          link,
          description: '',
          category: categorizeEvent(title, ''),
          image: '', // lazy-loaded client-side; not available via direct fetch
          venue: venue || 'Check event website',
          price,
          source: 'Urbanaut',
        })
      })

      console.log(`Urbanaut: Successfully scraped ${events.length} events`)

      return {
        events,
        metadata: { totalCount: events.length },
      }
    } catch (error) {
      console.error('Error scraping Urbanaut events:', error)
      return {
        events: [],
        metadata: { totalCount: 0 },
      }
    }
  },
}
