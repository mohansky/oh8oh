import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { fetchRenderedHTML } from './browser-helper'
import { categorizeEvent } from '../utils/categorize-event'

export const sabhaScraper: EventScraper = {
  id: 'sabha',
  name: 'Sabha',
  website: 'https://www.sabhablr.in',
  enabled: true, // Re-enabled after fixing Puppeteer helper hangs
  priority: 'low', // Run sequentially with other Puppeteer scrapers

  scrape: async (env?: any): Promise<ScraperResult> => {
    try {
      // Use Puppeteer to render the JavaScript
      const html = await fetchRenderedHTML(env?.BROWSER, 'https://www.sabhablr.in/events', {
        waitUntil: 'domcontentloaded', // Faster than networkidle0, sufficient for static content
        timeout: 30000,
        skipScroll: true, // Wix loads all events upfront, no need to scroll
      })

      const $ = cheerio.load(html)
      const events: ScraperResult['events'] = []

      // Use the correct Wix selectors found from debugging
      const $eventCards = $('li[data-hook="events-card"]')

      $eventCards.each((_, element) => {
        const $card = $(element)

        // Extract title using Wix data-hook
        const title = $card.find('a[data-hook="title"]').text().trim()

        // Extract link
        let link = $card.find('a[data-hook="title"]').attr('href') || ''
        if (link && !link.startsWith('http')) {
          link = link.startsWith('/')
            ? `https://www.sabhablr.in${link}`
            : `https://www.sabhablr.in/${link}`
        }

        // Extract date using Wix data-hook
        const date = $card.find('[data-hook="date"]').text().trim()

        // Extract image - Wix has 2 images per card: blurred placeholder and full quality
        // We want the second image (index 1) which is the full quality one
        const $images = $card.find('img')
        let image = ''

        if ($images.length > 1) {
          // Get the second image (full quality)
          image = $images.eq(1).attr('src') || ''
        } else if ($images.length === 1) {
          // Fallback to first image if only one exists
          image = $images.first().attr('src') || ''
        }

        if (image && !image.startsWith('http')) {
          if (image.startsWith('//')) {
            image = `https:${image}`
          } else if (image.startsWith('/')) {
            image = `https://www.sabhablr.in${image}`
          }
        }

        // Get image alt text as backup description
        const imageAlt = $card.find('img').first().attr('alt') || ''

        // Extract countdown/status text
        const countdown =
          $card.find('[data-hook="countdown"]').text().trim() || ''

        // Extract button text to determine ticket/RSVP status
        const buttonText = $card
          .find('button, [role="button"], a[data-hook*="button"], .button, [class*="button"]')
          .text()
          .trim()
          .toLowerCase()

        // Extract ticket link if available
        let ticketLink = ''
        const $ticketButton = $card.find('a[data-hook*="button"], a.button, a[class*="button"]')
        if ($ticketButton.length > 0) {
          ticketLink = $ticketButton.attr('href') || ''
          if (ticketLink && !ticketLink.startsWith('http')) {
            if (ticketLink.startsWith('//')) {
              ticketLink = `https:${ticketLink}`
            } else if (ticketLink.startsWith('/')) {
              ticketLink = `https://www.sabhablr.in${ticketLink}`
            }
          }
        }

        // Extract price - Wix might have price in various places
        let price = $card
          .find('[data-hook="price"], .price, [class*="price"], [class*="cost"]')
          .first()
          .text()
          .trim()

        // Check card text for additional info
        const cardText = $card.text().toLowerCase()

        // Determine price based on button text and other indicators
        if (!price) {
          if (buttonText.includes('buy ticket') || buttonText.includes('book ticket') || buttonText.includes('get ticket')) {
            // Check if it's a third-party ticket link (BookMyShow, Paytm, etc.)
            if (ticketLink) {
              const isThirdParty =
                ticketLink.includes('bookmyshow') ||
                ticketLink.includes('paytm') ||
                ticketLink.includes('insider.in') ||
                ticketLink.includes('townscript') ||
                ticketLink.includes('allevents.in')

              if (isThirdParty) {
                price = 'Ticketed (See Website)'
              } else {
                price = 'Ticketed'
              }
            } else {
              price = 'Ticketed'
            }
          } else if (buttonText.includes('more detail') || buttonText.includes('view detail') || buttonText.includes('learn more')) {
            price = 'RSVP Maybe Required'
          } else if (cardText.includes('free') || cardText.includes('complimentary') || cardText.includes('₹0')) {
            price = 'Free'
          } else if (cardText.includes('rsvp') || cardText.includes('rsvp required')) {
            price = 'RSVP Required'
          } else if (cardText.includes('registration required') || cardText.includes('register')) {
            price = 'Registration Required'
          }
        } else {
          // If price exists, check if RSVP or registration is also mentioned
          const hasRSVP = cardText.includes('rsvp') || cardText.includes('rsvp required')
          const hasRegistration = cardText.includes('registration required') ||
                                  cardText.includes('register') ||
                                  cardText.includes('registration')

          if (hasRSVP) {
            price += ' - RSVP Required'
          } else if (hasRegistration) {
            price += ' - Registration Required'
          }
        }

        // Only add if we have a valid title
        if (title && title.length > 3) {
          const description = countdown || imageAlt || 'Visit Sabha for more details'
          events.push({
            title,
            date: date || 'Check website for dates',
            time: '', // Wix stores time within date string
            link: link || 'https://www.sabhablr.in/events',
            description,
            image,
            venue: 'Sabha',
            category: categorizeEvent(title, description),
            price: price || undefined,
            source: 'Sabha',
          })
        }
      })

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping Sabha events with Puppeteer:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
