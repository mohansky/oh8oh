import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { fetchRenderedHTML } from './puppeteer-helper'
import { categorizeEvent } from '../utils/categorize-event'
import { cleanTimeString } from '../utils/date-time'

// Debug flag - set to true to see venue extraction details
const DEBUG_VENUE_EXTRACTION = false

/**
 * Parse date string and check if it's within the specified number of days
 * Default: 14 days (2 weeks) for better event coverage
 */
function isWithinTimeWindow(dateStr: string, days: number = 14): boolean {
  try {
    // Parse dates like "20 January 2026" or "16 January - 19 January 2026"
    const dateMatch = dateStr.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i)

    if (!dateMatch) return false

    const day = parseInt(dateMatch[1])
    const month = dateMatch[2]
    const year = parseInt(dateMatch[3])

    const monthMap: Record<string, number> = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
      'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    }

    const eventDate = new Date(year, monthMap[month], day)
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    return eventDate >= now && eventDate <= futureDate
  } catch (e) {
    // If we can't parse the date, include it to be safe
    return true
  }
}

/**
 * Fetch individual event page to get detailed venue information
 * NOTE: Currently disabled for performance (adds 10-30s per event)
 * Can be re-enabled by uncommenting the call in the scraper below
 */
async function fetchSkillboxesEventDetails(eventUrl: string, debug = false): Promise<{ venue?: string } | null> {
  try {
    const html = await fetchRenderedHTML(eventUrl, {
      waitUntil: 'networkidle2', // Wait for network to be idle for better content loading
      timeout: 30000,
    })

    if (!html) return null

    const $ = cheerio.load(html)

    if (debug) {
      console.log('\n=== DEBUG: Venue Extraction ===')
      console.log('URL:', eventUrl)
    }

    // Strategy 1: Look for JSON-LD structured data
    const $jsonLd = $('script[type="application/ld+json"]')
    if ($jsonLd.length > 0) {
      try {
        const jsonText = $jsonLd.first().html()
        if (jsonText) {
          const jsonData = JSON.parse(jsonText)

          // Extract venue from structured data
          if (jsonData.location && jsonData.location.name) {
            const venueName = jsonData.location.name
            const locality = jsonData.location.address?.addressLocality || 'Bangalore'
            if (debug) console.log('Found venue in JSON-LD:', `${venueName}, ${locality}`)
            return { venue: `${venueName}, ${locality}` }
          }
        }
      } catch (e) {
        // JSON parse error, continue to fallback
      }
    }

    // Strategy 2: Look for specific elements that might contain venue
    // Try common class names and data attributes used for location/venue
    const venueSelectors = [
      '[class*="venue"]',
      '[class*="location"]',
      '[class*="address"]',
      '[data-venue]',
      '[itemprop="location"]',
      '.event-venue',
      '.event-location',
    ]

    for (const selector of venueSelectors) {
      const $venueElement = $(selector)
      if ($venueElement.length > 0) {
        const venueText = $venueElement.first().text().trim()
        if (venueText && venueText.length >= 5 && venueText.length <= 100) {
          // Clean up the venue text
          const cleanVenue = venueText.replace(/\s+/g, ' ').trim()
          if (!cleanVenue.match(/^(venue|location|address):?$/i)) {
            if (debug) console.log(`Found venue in element (${selector}):`, cleanVenue)
            return { venue: cleanVenue.includes('Bangalore') || cleanVenue.includes('Bengaluru') ? cleanVenue : `${cleanVenue}, Bangalore` }
          }
        }
      }
    }

    // Strategy 3: Look for venue in page text patterns
    const pageText = $('body').text().replace(/\s+/g, ' ')

    // Pattern 1: "Venue Name, Bangalore/Bengaluru"
    const venuePattern1 = /([A-Z][^.,\n]{8,60}?),\s*(?:Bangalore|Bengaluru)/gi
    const matches1 = [...pageText.matchAll(venuePattern1)]

    for (const match of matches1) {
      const venueName = match[1].trim()
      // Filter out common non-venue text
      if (!venueName.match(/India|January|February|March|April|May|June|July|August|September|October|November|December|\d{4}|Event|Date|Time|Ticket|Price|About|Follow|Share|Book|Register|Copyright|Privacy|Terms/i)) {
        if (venueName.length >= 8 && venueName.length <= 60) {
          if (debug) console.log('Found venue in pattern 1:', `${venueName}, Bangalore`)
          return { venue: `${venueName}, Bangalore` }
        }
      }
    }

    // Pattern 2: Look for "venue:", "location:", "address:" labels
    const venuePattern2 = /(?:venue|location|address)[\s:]+([A-Z][^,\n]{5,60})/gi
    const matches2 = [...pageText.matchAll(venuePattern2)]

    for (const match of matches2) {
      const venueName = match[1].trim()
      if (venueName.length >= 5 && venueName.length <= 60) {
        if (debug) console.log('Found venue in pattern 2:', `${venueName}, Bangalore`)
        return { venue: venueName.includes('Bangalore') || venueName.includes('Bengaluru') ? venueName : `${venueName}, Bangalore` }
      }
    }

    // Strategy 4: Look for common venue names in Bangalore (less strict pattern)
    // This catches venues even without "Bangalore" suffix
    const commonVenuePatterns = [
      /\b([A-Z][a-z]+\s+(?:Social|Bar|Pub|Cafe|Lounge|Club|Arena|Stadium|Hall|Theatre|Center|Centre|Grounds?|Garden))\b/gi,
      /\b(The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,/gi,
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:Indiranagar|Koramangala|Whitefield|HSR|Jayanagar|MG Road|Brigade Road)/gi,
    ]

    for (const pattern of commonVenuePatterns) {
      const matches = [...pageText.matchAll(pattern)]
      for (const match of matches) {
        const venueName = match[1].trim()
        // Additional filtering
        if (!venueName.match(/^(The\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Event|Date|Time|Book|Buy|Get|Share|Follow|About|Terms|Privacy)/i)) {
          if (venueName.length >= 5 && venueName.length <= 60) {
            if (debug) console.log('Found venue in pattern 4 (common venues):', `${venueName}, Bangalore`)
            return { venue: venueName.includes('Bangalore') || venueName.includes('Bengaluru') ? venueName : `${venueName}, Bangalore` }
          }
        }
      }
    }

    // Strategy 5: Extract from meta tags
    const ogLocation = $('meta[property="event:location"]').attr('content')
    if (ogLocation && ogLocation.length > 3) {
      if (debug) console.log('Found venue in meta tag:', ogLocation)
      return { venue: ogLocation.includes('Bangalore') || ogLocation.includes('Bengaluru') ? ogLocation : `${ogLocation}, Bangalore` }
    }

    if (debug) {
      console.log('No venue found - Tried all strategies')
      // Output a sample of the page text for debugging
      console.log('Page text sample (first 500 chars):', pageText.substring(0, 500))
    }
    return null
  } catch (error) {
    console.error(`Skillboxes: Error fetching details for ${eventUrl}:`, error)
    return null
  }
}

export const skillboxesScraper: EventScraper = {
  id: 'skillboxes',
  name: 'Skillboxes',
  website: 'https://www.skillboxes.com',
  enabled: true,
  priority: 'low', // Low priority due to slow scraping speed

  scrape: async (): Promise<ScraperResult> => {
    try {
      // Filter by Bangalore (city ID 9)
      const url = 'https://www.skillboxes.com/events?filter=%7B%22selectedCity%22:9%7D'

      // Use Puppeteer to render the JavaScript-heavy page
      const html = await fetchRenderedHTML(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
        skipScroll: true, // Events load upfront, no need to scroll
        waitAfterLoad: 3000, // Wait for React/JS to render events
      })

      if (!html || html.length < 100) {
        return { events: [] }
      }

      const $ = cheerio.load(html)
      const events: ScraperResult['events'] = []

      // Find all event cards in the grid
      const $eventCards = $('.event-result-box')

      // Collect promises for fetching individual event details
      const eventPromises: Promise<any>[] = []

      $eventCards.each((_, element) => {
        const $card = $(element)

        // Extract event link
        const $link = $card.find('a[href^="/events/"]').first()
        const href = $link.attr('href')
        if (!href || href === '/events') return

        const link = `https://www.skillboxes.com${href}`

        // Extract title from image alt attribute
        const $img = $card.find('img').first()
        const title = $img.attr('alt')?.trim() || ''
        if (!title || title.length < 3) return

        // Extract image URL
        const image = $img.attr('src') || ''

        // Get all text content from the card
        const cardText = $card.text().trim().replace(/\s+/g, ' ')

        // Extract category (first text before title)
        const categoryMatch = cardText.match(/^([^|]+?)\s+(?=\w)/)
        const rawCategory = categoryMatch ? categoryMatch[1].replace(title, '').trim() : ''

        // Extract location, date, time pattern: "Bangalore | India | 20 January 2026 | 08:00 PM"
        // or "Bangalore | India | 16 January - 19 January 2026 | 08:00 AM"
        // or "Bangalore | India | 20 January 2026 | To Be Announced"
        const locationDatePattern = /(?:Bangalore|Bengaluru)\s*\|\s*India\s*\|\s*([^|]+?)\s*\|\s*(.+?)(?:\s+(?:Hip-Hop|Live Music|Music|INR|₹)|$)/i
        const locationDateMatch = cardText.match(locationDatePattern)

        let date = 'Check website for dates'
        let time = ''
        let venue = 'Check event website'

        if (locationDateMatch) {
          const rawDate = locationDateMatch[1].trim()
          const rawTime = locationDateMatch[2].trim()

          // Parse date (e.g., "20 January 2026" or "16 January - 19 January 2026")
          date = rawDate

          // Parse and clean time - removes category/venue info that may have leaked in
          if (rawTime && rawTime !== 'To Be Announced' && !rawTime.startsWith('India')) {
            time = cleanTimeString(rawTime)
          }
        }

        // Extract price pattern: "INR 499 onwards" or "INR 0 Onwards"
        const pricePattern = /INR\s*(\d+(?:,\d+)?)\s*(?:onwards|Onwards|\(.*?\))?/i
        const priceMatch = cardText.match(pricePattern)

        let price = 'Check website for price'
        if (priceMatch) {
          const priceValue = parseInt(priceMatch[1].replace(/,/g, ''))
          if (priceValue === 0) {
            price = 'Free'
          } else {
            price = `₹${priceMatch[1]}`
          }
        }

        // Categorize the event with enhanced multi-category support
        // Pass cardText as description for better categorization
        const category = categorizeEvent(title, cardText, rawCategory)

        // Debug: Log category detection
        if (DEBUG_VENUE_EXTRACTION && Array.isArray(category) && category.length > 1) {
          console.log(`📋 Multi-category detected for "${title}":`, category)
        }

        // Filter: Only process events within the configured time window (14 days default)
        if (!isWithinTimeWindow(date)) {
          return
        }

        // Create promise to fetch detailed venue information
        const eventPromise = (async () => {
          // OPTIMIZATION: Skip individual page fetch for faster scraping
          // Venue details from listing page are sufficient (shows "Bangalore")
          // Uncomment below to fetch detailed venue (adds 10-30s per event):
          // const details = await fetchSkillboxesEventDetails(link, DEBUG_VENUE_EXTRACTION)
          // if (details?.venue) {
          //   venue = details.venue
          // }

          return {
            title,
            date,
            time,
            venue,
            price,
            link,
            source: 'skillboxes',
            image,
            category,
          }
        })()

        eventPromises.push(eventPromise)
      })

      // Prioritize first 10 events for faster initial results
      const priorityCount = 10 // Process first 10 events with high priority
      const priorityEvents = eventPromises.slice(0, priorityCount)
      const remainingEvents = eventPromises.slice(priorityCount)

      // Process priority events first (high priority - faster response)
      if (priorityEvents.length > 0) {
        const priorityResults = await Promise.all(priorityEvents)
        events.push(...priorityResults)
      }

      // Process remaining events in batches with lower priority
      if (remainingEvents.length > 0) {
        const batchSize = 5 // Smaller batches for remaining events
        for (let i = 0; i < remainingEvents.length; i += batchSize) {
          const batch = remainingEvents.slice(i, i + batchSize)
          const batchResults = await Promise.all(batch)
          events.push(...batchResults)

          // Add small delay between batches to avoid overwhelming Puppeteer
          if (i + batchSize < remainingEvents.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
          }
        }
      }

      return { events }
    } catch (error) {
      console.error('Skillboxes scraper error:', error)
      return { events: [] }
    }
  },
}
