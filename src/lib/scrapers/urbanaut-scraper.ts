import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { fetchRenderedHTML } from './puppeteer-helper'
import { categorizeEvent } from '../utils/categorize-event'

export const urbanautScraper: EventScraper = {
  id: 'urbanaut',
  name: 'Urbanaut',
  website: 'https://urbanaut.app',
  enabled: true, // Enabled - tested and working
  priority: 'low', // Uses Puppeteer

  scrape: async (): Promise<ScraperResult> => {
    try {
      const events: ScraperResult['events'] = []

      const url = 'https://urbanaut.app/experience-bengaluru/events'
      console.log(`🎪 Fetching Urbanaut events from ${url}...`)

      const html = await fetchRenderedHTML(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
        waitAfterLoad: 3000, // Extra wait for Angular to render
        skipScroll: false, // Might need scrolling for lazy-loaded content
      })

      if (!html || html.length < 100) {
        console.log('Urbanaut: Failed to fetch page content')
        return { events: [] }
      }

      const $ = cheerio.load(html)

      // Find all event cards with type="explore"
      const $eventCards = $('app-spot-card[type="explore"]')
      console.log(`Urbanaut: Found ${$eventCards.length} event cards`)

      if ($eventCards.length === 0) {
        console.log('Urbanaut: No event cards found')
        return { events: [] }
      }

      // Track seen links to avoid duplicates
      const seenLinks = new Set<string>()

      $eventCards.each((_, element) => {
        const $card = $(element)

        // Extract title and link
        const $titleLink = $card.find('a.title-link').first()
        const title = $titleLink.find('.pre-wrap').text().trim()
        let link = $titleLink.attr('href') || ''

        if (!title || title.length < 3) return
        if (!link) return

        // Convert relative URL to absolute
        if (!link.startsWith('http')) {
          link = link.startsWith('/')
            ? `https://urbanaut.app${link}`
            : `https://urbanaut.app/${link}`
        }

        // Skip duplicates
        if (seenLinks.has(link)) return
        seenLinks.add(link)

        // Extract category from tag badge
        const $categoryBadge = $card.find('.who-is-it-for-tags .tag-badge').first()
        let category = $categoryBadge.text().trim()
        // Remove the icon text if present
        category = category.replace(/^\s*[a-z\s&]+\s+/, '').trim()
        if (!category) {
          category = categorizeEvent(title, '')
        }

        // Extract date and venue from the date-time spans
        const $dateTimes = $card.find('.date-time')
        let date = ''
        let venue = ''

        if ($dateTimes.length >= 1) {
          date = $dateTimes.eq(0).text().trim()
        }
        if ($dateTimes.length >= 2) {
          venue = $dateTimes.eq(1).text().trim()
        }

        // Add year to date (similar to District scraper)
        if (date && !date.match(/\d{4}/)) {
          const currentDate = new Date()
          const currentYear = currentDate.getFullYear()
          const currentMonth = currentDate.getMonth()

          // Extract month from date string (e.g., "Saturday, Dec 13")
          const monthMatch = date.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)
          if (monthMatch) {
            const month = monthMatch[1]
            const monthNum = new Date(`${month} 1, 2000`).getMonth()

            let year = currentYear
            if (monthNum < currentMonth) {
              year = currentYear + 1
            } else if (monthNum === currentMonth) {
              const dayMatch = date.match(/\b(\d{1,2})\b/)
              if (dayMatch) {
                const day = parseInt(dayMatch[1])
                if (day < currentDate.getDate()) {
                  year = currentYear + 1
                }
              }
            }

            // Format: "Saturday, Dec 13" -> "Saturday, Dec 13 2025"
            date = `${date} ${year}`
          }
        }

        // Extract price
        const $priceText = $card.find('.price-text').first()
        let price = $priceText.text().trim()

        // Check for "starts at" or "onwards" prefix
        const $onwards = $card.find('.onwards').first()
        if ($onwards.length > 0 && price) {
          const onwardsText = $onwards.text().trim()
          if (onwardsText && !price.toLowerCase().includes('onwards') && !price.toLowerCase().includes('starts')) {
            price = `${onwardsText} ${price}`
          }
        }

        if (!price) price = 'Check website for price'

        // Extract image from carousel
        const $image = $card.find('app-simple-carousel img').first()
        const image = $image.attr('src') || ''

        // Extract time if present (not visible in current examples, but check)
        const time = 'Time TBA'

        // Add event
        events.push({
          title,
          date: date || 'Check website for dates',
          time,
          link,
          description: '',
          category,
          image,
          venue: venue || 'Check event website',
          price,
          source: 'Urbanaut',
        })
      })

      console.log(`Urbanaut: Successfully scraped ${events.length} events`)

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping Urbanaut events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
