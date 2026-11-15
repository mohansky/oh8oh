import * as cheerio from 'cheerio'
import { categorizeEvent } from '../utils/categorize-event'
import { fetchRenderedHTML } from './browser-helper'
import type { EventScraper, ScraperResult } from './types'

/**
 * MAP (Museum of Art & Photography) — https://map-india.org/events/
 *
 * The events page is a WordPress "Events Manager" plugin page whose list is
 * populated client-side via admin-ajax (the server HTML ships empty article
 * shells), so this scraper renders the page with Puppeteer and reads the
 * Events Manager markup.
 *
 * ⚠️ Caveat: MAP's Events Manager iCal export (`/events/?ical=1`) is currently
 * frozen at 2021 events. If the rendered page likewise has no upcoming events,
 * MAP has no usable public source and this scraper will return []. Verify a
 * live run (pnpm dev:wrangler) before relying on it. See SCRAPERS.md.
 */
export const mapScraper: EventScraper = {
  id: 'map',
  name: 'MAP (Museum of Art & Photography)',
  website: 'https://map-india.org',
  enabled: true,
  priority: 'low', // JS-rendered — needs the BROWSER binding

  scrape: async (env?: any): Promise<ScraperResult> => {
    try {
      const url = 'https://map-india.org/events/'
      console.log(`🖼️ Fetching MAP events from ${url}...`)

      const html = await fetchRenderedHTML(env?.BROWSER, url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
        waitAfterLoad: 3000, // let Events Manager AJAX populate the list
        skipScroll: true,
      })

      if (!html || html.length < 100) {
        console.log('MAP: no rendered content')
        return { events: [] }
      }

      const $ = cheerio.load(html)
      const events: ScraperResult['events'] = []
      const seenLinks = new Set<string>()

      // Events Manager list markup, with generic fallbacks
      const $items = $(
        '.em-item, .em-event, .em-events-list-item, .em-event-list-item, article.event, .type-event',
      )
      console.log(`MAP: found ${$items.length} event items`)

      $items.each((_, element) => {
        const $item = $(element)

        const $titleLink = $item
          .find('.em-item-title a, .em-event-title a, h2 a, h3 a, .entry-title a')
          .first()
        const title = $titleLink.text().trim()
        let link = $titleLink.attr('href') || $item.find('a').first().attr('href') || ''

        if (!title || title.length < 3 || !link) return
        if (!link.startsWith('http')) {
          link = link.startsWith('/') ? `https://map-india.org${link}` : `https://map-india.org/${link}`
        }
        if (seenLinks.has(link)) return
        seenLinks.add(link)

        const date =
          $item
            .find('.em-item-date, .em-event-date, time, [class*="date"]')
            .first()
            .text()
            .trim() || 'Check website for dates'

        let image =
          $item.find('img').first().attr('src') ||
          $item.find('img').first().attr('data-src') ||
          ''
        if (image && !image.startsWith('http')) {
          image = image.startsWith('//') ? `https:${image}` : `https://map-india.org${image}`
        }

        const description = $item.find('.em-item-description, p, .excerpt').first().text().trim()

        events.push({
          title,
          date,
          time: 'Time TBA',
          link,
          description,
          category: categorizeEvent(title, description),
          image,
          venue: 'Museum of Art & Photography',
          price: undefined,
          source: 'MAP',
        })
      })

      console.log(`MAP: scraped ${events.length} events`)
      return {
        events,
        metadata: { totalCount: events.length },
      }
    } catch (error) {
      console.error('Error scraping MAP events:', error)
      return {
        events: [],
        metadata: { totalCount: 0 },
      }
    }
  },
}
