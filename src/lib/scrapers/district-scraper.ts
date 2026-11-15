import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { categorizeEvent } from '../utils/categorize-event'
import { fetchRenderedHTML } from './puppeteer-helper'

export const districtScraper: EventScraper = {
  id: 'district',
  name: 'District',
  website: 'https://www.district.in',
  enabled: true, // Enabled - tested and working
  priority: 'low', // Uses Puppeteer, so low priority

  scrape: async (): Promise<ScraperResult> => {
    try {
      const events: ScraperResult['events'] = []

      // Fetch the music events page for Bengaluru using Puppeteer
      const url = 'https://www.district.in/events/music-in-bengaluru-book-tickets'
      console.log(`🎵 Fetching District music events from ${url}...`)

      const html = await fetchRenderedHTML(url, {
        waitUntil: 'networkidle2', // Wait for network requests to complete
        timeout: 45000, // Increased timeout for API calls
        waitAfterLoad: 2000, // Wait for React to render after data loads
        skipScroll: true, // Events load upfront
      })

      if (!html || html.length < 100) {
        console.log('District: Failed to fetch page content')
        return { events: [] }
      }

      const $ = cheerio.load(html)

      // District has event cards with class "item-cards" (note: plural)
      // Each card contains an <a> tag with all the event info
      const $eventCards = $('.item-cards')
      console.log(`District: Found ${$eventCards.length} event cards`)

      if ($eventCards.length === 0) {
        console.log('District: No event cards found')
        console.log('District: Page title:', $('title').text())
        return { events: [] }
      }

      // Track seen links to avoid duplicates
      const seenLinks = new Set<string>()

      // Process each event card
      $eventCards.each((_, element) => {
        const $card = $(element)
        // The <a> tag is the parent of .item-cards
        const $link = $card.closest('a')
        if ($link.length === 0) return

        const link = $link.attr('href') || ''
        if (!link) return

        // Skip duplicates
        if (seenLinks.has(link)) return
        seenLinks.add(link)

        // The link text contains all info concatenated: "Day, DD Mon, HH:MM PMTitleVenue, City₹PRICEBook tickets"
        // Example: "Tue, 23 Dec, 7:00 PMAbove & Beyond x SourberryCavore, Bengaluru₹6500Book tickets"
        const fullText = $link.text().trim()

        // Extract date and time (at the beginning)
        // Pattern: "Day, DD Mon, HH:MM PM" or "Day, DD Mon – Day, DD Mon, HH:MM PM" (for multi-day)
        const dateTimeMatch = fullText.match(/^([A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}(?:\s+–\s+[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3})?,\s+\d{1,2}:\d{2}\s+[AP]M)/)
        let dateTime = dateTimeMatch ? dateTimeMatch[1] : ''

        // Split date and time
        let date = ''
        let time = ''
        if (dateTime) {
          const timeMatch = dateTime.match(/(\d{1,2}:\d{2}\s+[AP]M)$/)
          time = timeMatch ? timeMatch[1] : 'Time TBA'
          const dateWithoutTime = dateTime.replace(/,\s+\d{1,2}:\d{2}\s+[AP]M$/, '').trim()

          // Add year to the date since District doesn't include it
          // Format is "Day, DD Mon" or "Day, DD Mon – Day, DD Mon"
          // If month is Dec and we're in Dec, use current year, otherwise next year
          // If month is Jan-Nov, use next year
          const currentDate = new Date()
          const currentYear = currentDate.getFullYear()
          const currentMonth = currentDate.getMonth()

          // Extract month from date string
          const monthMatch = dateWithoutTime.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)
          if (monthMatch) {
            const month = monthMatch[1]
            const monthNum = new Date(`${month} 1, 2000`).getMonth()

            // If the event month is before the current month, it must be next year
            // If event month is current month or later, check if it's already passed
            let year = currentYear
            if (monthNum < currentMonth) {
              year = currentYear + 1
            } else if (monthNum === currentMonth) {
              // Same month - check day
              const dayMatch = dateWithoutTime.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i)
              if (dayMatch) {
                const day = parseInt(dayMatch[1])
                if (day < currentDate.getDate()) {
                  year = currentYear + 1
                }
              }
            }

            date = `${dateWithoutTime} ${year}`
          } else {
            date = dateWithoutTime
          }
        }

        // Extract price (₹ followed by digits, before "Book tickets")
        const priceMatch = fullText.match(/₹([\d,]+(?:\s+onwards)?)(?=Book tickets)/i)
        const price = priceMatch ? `₹${priceMatch[1]}` : 'Check website for price'

        // Extract venue and title
        // Remove the date/time prefix and the price/Book tickets suffix
        let remainingText = fullText
        if (dateTime) {
          remainingText = remainingText.replace(dateTime, '').trim()
        }
        // Remove the entire price section including "₹...Book tickets" or "₹..." at the end
        remainingText = remainingText.replace(/₹[\d,]+(?:\s+onwards)?(?:Book tickets)?$/i, '').trim()

        // Pattern: "TitleVenue Name, City" or "TitleCity"
        // The city is at the very end, preceded by a comma and optional venue
        let title = ''
        let venue = 'Check event website'

        // Try to find city at the end
        const cityMatch = remainingText.match(/^(.+?),\s*(Bengaluru|Bangalore|Hosur)$/i)
        if (cityMatch) {
          const beforeCity = cityMatch[1]
          const city = cityMatch[2]

          // Check if there's another comma (title, venue, city pattern)
          const lastCommaIndex = beforeCity.lastIndexOf(',')
          if (lastCommaIndex > 0) {
            // Pattern: "Title, Venue, City"
            title = beforeCity.substring(0, lastCommaIndex).trim()
            venue = beforeCity.substring(lastCommaIndex + 1).trim() + ', ' + city
          } else {
            // Pattern: "Title, City" or "TitleVenue, City"
            // Try to detect if venue is concatenated with title
            // Common venue patterns: ends with specific venue names or contains "Venue to be announced"
            if (beforeCity.includes('Venue to be announced')) {
              title = beforeCity.replace('Venue to be announced', '').trim()
              venue = 'Venue to be announced, ' + city
            } else {
              // Assume everything before city is the title
              title = beforeCity.trim()
              venue = 'Check event website'
            }
          }
        } else {
          // No city found, use entire text as title
          title = remainingText.trim()
        }

        if (!title || title.length < 3) return

        // Get image from background-image style if available
        let image = ''
        const bgImageMatch = $card.html()?.match(/background-image:\s*url\(['"&]*(https:\/\/[^'"&]+)['"&]*\)/)
        if (bgImageMatch) {
          image = bgImageMatch[1]
        }
        // Fallback to img tag
        if (!image) {
          image = $card.find('img').first().attr('src') ||
                  $card.find('img').first().attr('data-src') || ''
        }

        // Add event
        events.push({
          title,
          date: date || 'Check website for dates',
          time: time || 'Time TBA',
          link: link.startsWith('http') ? link : `https://www.district.in${link}`,
          description: '',
          category: 'Music',
          image,
          venue,
          price,
          source: 'District',
        })
      })

      console.log(`District: Successfully scraped ${events.length} music events`)

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping District events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
