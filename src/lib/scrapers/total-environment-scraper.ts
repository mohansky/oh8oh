import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'
import { tmpdir } from 'os'
import { join } from 'path'
import { EventScraper, ScraperResult } from './types'
import { categorizeEvent } from '../utils/categorize-event'
import { cleanTimeString } from '../utils/date-time'

export const totalEnvironmentScraper: EventScraper = {
  id: 'total-environment',
  name: 'Total Environment',
  website: 'https://www.total-environment.com',
  enabled: true, // Re-enabled for testing after Puppeteer fixes
  priority: 'low', // Use Puppeteer, run sequentially

  scrape: async (): Promise<ScraperResult> => {
    let browser = null
    try {
      console.log('🚀 Launching Puppeteer for Total Environment (mobile viewport)...')

      // Use unique profile to avoid conflicts
      const uniqueProfile = join(tmpdir(), `puppeteer_evre_${Date.now()}_${Math.random().toString(36).substring(7)}`)

      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        userDataDir: uniqueProfile,
      })

      const page = await browser.newPage()

      // Set MOBILE viewport and user agent (required for content to load!)
      await page.setViewport({
        width: 375,
        height: 812,
        isMobile: true,
        hasTouch: true,
      })
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      )

      // Navigate to the page
      const url = 'https://www.total-environment.com/music-and-events'
      console.log(`📱 Navigating to ${url}...`)

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Short wait for React hydration
      console.log('⏳ Waiting for mobile content to load...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Get the page content
      const html = await page.content()
      console.log('✅ Page content extracted')

      // Close browser
      await browser.close()
      browser = null

      const $ = cheerio.load(html)

      const events: ScraperResult['events'] = []

      // Look for mobile event cards
      const eventCards = $('.event-card-mobile')
      console.log(`📋 Found ${eventCards.length} event cards`)

      eventCards.each((_, element) => {
        const $event = $(element)

        // Extract date (in h1 tag like "Nov 21 & 22")
        const date = $event.find('h1').first().text().trim() || 'Date TBA'

        // Extract title (in h2 tag within .event-header)
        const title = $event.find('.event-header h2').first().text().trim() ||
                      $event.find('h2').first().text().trim()

        // Extract genre/category (text after title in .event-header)
        const genreText = $event.find('.event-header').text().replace(title, '').trim()

        // Extract time and venue from .event-content
        const eventContent = $event.find('.event-content').text().trim()

        // Time is usually at the start (e.g., "09:30 PM onwards")
        const timeMatch = eventContent.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*onwards)?)/i)
        const rawTime = timeMatch ? timeMatch[1] : ''
        const time = cleanTimeString(rawTime)

        // Venue is after time (e.g., "Windmills", "Whitefield, Bangalore")
        const venueText = eventContent.replace(rawTime, '').trim()
        const venue = venueText || 'Windmills, Whitefield, Bangalore'

        // Extract link (EXPLORE button)
        let link = $event.find('a').first().attr('href') || ''
        if (link && !link.startsWith('http')) {
          link = `https://www.total-environment.com${link}`
        }

        // Extract image
        const image = $event.find('img').first().attr('src') ||
                      $event.find('img').first().attr('data-src') ||
                      ''

        // Build description from available info
        const description = genreText ? `${genreText}. ${eventContent}` : eventContent

        // Price - Total Environment events are typically free/RSVP
        const price = 'RSVP Required'

        if (title) {
          events.push({
            title,
            date,
            time,
            link,
            description,
            category: categorizeEvent(title, description),
            image: image && !image.startsWith('http')
              ? `https://www.total-environment.com${image}`
              : image,
            venue,
            price: price || undefined,
            source: 'Total Environment',
          })
        }
      })

      console.log(`✅ Extracted ${events.length} events`)

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping Total Environment events:', error)

      // Ensure browser is closed in case of error
      if (browser) {
        try {
          await browser.close()
        } catch (closeError) {
          console.error('Error closing browser:', closeError)
        }
      }

      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
