import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { categorizeEvent } from '../utils/categorize-event'

export const ihaScraper: EventScraper = {
  id: 'iha',
  name: 'Indian Heritage Academy',
  website: 'https://indianheritageacademy.org',
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const response = await fetch('https://indianheritageacademy.org/events/')
      const html = await response.text()

      const $ = cheerio.load(html)
      const events: ScraperResult['events'] = []

      // Find event containers - they use "etn-event" classes
      const $eventContainers = $('[class*="etn-event-item"], .etn-event-item')

      // If specific container not found, try broader search
      if ($eventContainers.length === 0) {

        // Look for containers with both image and title
        $('.etn-event-content').parent().each((_, element) => {
          const $container = $(element)

          // Extract title
          const title = $container
            .find('.etn-title.etn-event-title a, h2.etn-event-title a')
            .first()
            .text()
            .trim()

          // Extract link
          let link =
            $container
              .find('.etn-title.etn-event-title a, h2.etn-event-title a')
              .first()
              .attr('href') || ''

          // Make sure link is absolute
          if (link && !link.startsWith('http')) {
            link = `https://indianheritageacademy.org${link.startsWith('/') ? '' : '/'}${link}`
          }

          // Extract date and time
          const dateText = $container.find('.etn-event-date').text().trim()

          // Parse date and time (format: "Sun 16 Nov 2025 06:00 PM – 07:30 PM")
          const dateMatch = dateText.match(/([A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/)
          const timeMatch = dateText.match(/(\d{1,2}:\d{2}\s+[AP]M)\s*–\s*(\d{1,2}:\d{2}\s+[AP]M)/)

          const date = dateMatch ? dateMatch[1] : dateText
          const time = timeMatch ? `${timeMatch[1]} – ${timeMatch[2]}` : ''

          // Extract description (usually contains language, age, duration info)
          const description = $container.find('.etn-event-content p').first().text().trim()

          // Extract image
          let image = $container.find('.etn-event-thumb img, img.wp-post-image').first().attr('src') || ''

          // Clean up image URL (remove WordPress parameters if needed)
          if (image && image.includes('?')) {
            const cleanImage = image.split('?')[0]
            if (cleanImage) image = cleanImage
          }

          // Extract location if available
          const venue =
            $container.find('.etn-event-location').text().trim() || 'Indian Heritage Academy'

          // Extract price
          let price = $container.find('.etn-event-price, .price, [class*="price"], [class*="cost"]').first().text().trim()

          // Check container text for additional info
          const containerText = $container.text().toLowerCase()

          // Check for RSVP or registration requirements
          const hasRSVP = containerText.includes('rsvp') || containerText.includes('rsvp required')
          const hasRegistration = containerText.includes('registration required') ||
                                  containerText.includes('register') ||
                                  containerText.includes('registration')

          if (!price) {
            if (containerText.includes('free') || containerText.includes('complimentary') || containerText.includes('₹0')) {
              price = 'Free'
            } else if (hasRSVP) {
              price = 'RSVP Required'
            } else if (hasRegistration) {
              price = 'Registration Required'
            }
          } else {
            // Add RSVP/registration info to existing price
            if (hasRSVP) {
              price += ' - RSVP Required'
            } else if (hasRegistration) {
              price += ' - Registration Required'
            }
          }

          // Only add if we have a valid title
          if (title && title.length > 3) {
            events.push({
              title,
              date,
              time,
              link,
              description,
              category: categorizeEvent(title, description),
              image,
              venue,
              price: price || undefined,
              source: 'Indian Heritage Academy',
            })
          }
        })
      } else {
        // Use the specific event containers
        $eventContainers.each((_, element) => {
          const $container = $(element)

          const title = $container.find('.etn-title a, h2 a').first().text().trim()
          let link = $container.find('.etn-title a, h2 a').first().attr('href') || ''

          if (link && !link.startsWith('http')) {
            link = `https://indianheritageacademy.org${link.startsWith('/') ? '' : '/'}${link}`
          }

          const dateText = $container.find('.etn-event-date').text().trim()
          const dateMatch = dateText.match(/([A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/)
          const timeMatch = dateText.match(/(\d{1,2}:\d{2}\s+[AP]M)\s*–\s*(\d{1,2}:\d{2}\s+[AP]M)/)

          const date = dateMatch ? dateMatch[1] : dateText
          const time = timeMatch ? `${timeMatch[1]} – ${timeMatch[2]}` : ''

          const description = $container.find('p').first().text().trim()
          let image = $container.find('img').first().attr('src') || ''

          if (image && image.includes('?')) {
            image = image.split('?')[0]
          }

          const venue = $container.find('.etn-event-location').text().trim() || 'Indian Heritage Academy'

          // Extract price
          let price2 = $container.find('.etn-event-price, .price, [class*="price"], [class*="cost"]').first().text().trim()

          // Check container text for additional info
          const containerText2 = $container.text().toLowerCase()

          // Check for RSVP or registration requirements
          const hasRSVP2 = containerText2.includes('rsvp') || containerText2.includes('rsvp required')
          const hasRegistration2 = containerText2.includes('registration required') ||
                                   containerText2.includes('register') ||
                                   containerText2.includes('registration')

          if (!price2) {
            if (containerText2.includes('free') || containerText2.includes('complimentary') || containerText2.includes('₹0')) {
              price2 = 'Free'
            } else if (hasRSVP2) {
              price2 = 'RSVP Required'
            } else if (hasRegistration2) {
              price2 = 'Registration Required'
            }
          } else {
            // Add RSVP/registration info to existing price
            if (hasRSVP2) {
              price2 += ' - RSVP Required'
            } else if (hasRegistration2) {
              price2 += ' - Registration Required'
            }
          }

          if (title && title.length > 3) {
            events.push({
              title,
              date,
              time,
              link,
              description,
              category: categorizeEvent(title, description),
              image,
              venue,
              price: price2 || undefined,
              source: 'Indian Heritage Academy',
            })
          }
        })
      }

      // Remove duplicates based on title and link
      const uniqueEvents = events.filter(
        (event, index, self) =>
          index === self.findIndex((e) => e.title === event.title && e.link === event.link),
      )

      return {
        events: uniqueEvents,
        metadata: {
          totalCount: uniqueEvents.length,
        },
      }
    } catch (error) {
      console.error('Error scraping Indian Heritage Academy events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
