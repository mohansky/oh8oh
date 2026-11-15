import * as cheerio from 'cheerio'
import { categorizeEvent } from '../utils/categorize-event'
import { cleanTimeString } from '../utils/date-time'
import type { EventScraper, ScraperResult } from './types'

export const imeScraper: EventScraper = {
  id: 'indian-music-experience',
  name: 'Indian Music Experience',
  website: 'https://indianmusicexperience.org',
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const url = 'https://indianmusicexperience.org/events/'
      console.log(`Fetching Indian Music Experience events from ${url}...`)

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      const events: ScraperResult['events'] = []

      // Find all event containers, excluding past events
      $('.mec-timeline-event').each((_, element) => {
        const $event = $(element)

        // Skip past events
        if ($event.hasClass('mec-past-event')) {
          return
        }

        // Extract title
        const title = $event.find('h4.mec-event-title a').first().text().trim()

        if (!title) {
          return // Skip if no title
        }

        // Extract link
        const link = $event.find('h4.mec-event-title a').first().attr('href') || ''

        // Extract date
        const date = $event.find('.mec-timeline-event-date').first().text().trim()

        // Extract time
        const startTime = $event
          .find('.mec-timeline-event-time .mec-start-time')
          .first()
          .text()
          .trim()
        const endTime = $event
          .find('.mec-timeline-event-time .mec-end-time')
          .first()
          .text()
          .trim()

        const rawTime = endTime ? `${startTime} - ${endTime}` : startTime
        const time = cleanTimeString(rawTime) || rawTime

        // Extract image
        const image =
          $event.find('.mec-timeline-event-image img').first().attr('src') || ''

        // Extract venue - check for location details
        const venueElement = $event.find('.mec-timeline-event-location').first()
        let venue = venueElement.text().trim()

        // If no specific venue found, use default
        if (!venue) {
          venue = 'Indian Music Experience, Bangalore'
        }

        // Extract price/cost if available
        const priceElement = $event.find('.mec-event-cost, .mec-price').first()
        const price = priceElement.text().trim() || 'Check website for details'

        // Extract description
        const description =
          $event.find('.mec-event-description, p').first().text().trim() || ''

        // Build event object
        events.push({
          title,
          date,
          time: time || 'Time TBA',
          link,
          description,
          category: categorizeEvent(title, description),
          image,
          venue,
          price,
          source: 'Indian Music Experience',
        })
      })

      console.log(`Found ${events.length} upcoming events from Indian Music Experience`)

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping Indian Music Experience events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
