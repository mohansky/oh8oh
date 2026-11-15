import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { categorizeEvent } from '../utils/categorize-event'

// Helper function to fetch and parse individual event page
async function fetchEventDetails(eventUrl: string) {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(eventUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract time from various possible selectors
    let time = ''
    const timeSelectors = [
      'time',
      '.event-time',
      '.time',
      '[class*="time"]',
      '.event-schedule',
      '[class*="schedule"]',
    ]

    for (const tsel of timeSelectors) {
      time = $(tsel).first().text().trim()
      if (time && time.length > 2) break
    }

    // Extract price from various possible selectors
    let price = ''
    const priceSelectors = [
      '.price',
      '.cost',
      '.event-price',
      '.event-cost',
      '[class*="price"]',
      '[class*="cost"]',
      '[class*="ticket"]',
    ]

    for (const psel of priceSelectors) {
      price = $(psel).first().text().trim()
      if (price && price.length > 0) break
    }

    // Check full page text for additional info
    const pageText = $('body').text().toLowerCase()

    // Check for RSVP or registration requirements
    const hasRSVP = pageText.includes('rsvp') || pageText.includes('rsvp required')
    const hasRegistration =
      pageText.includes('registration required') ||
      pageText.includes('register') ||
      pageText.includes('registration')

    // Determine final price/registration info
    if (!price) {
      if (pageText.includes('free admission') || pageText.includes('free entry') || pageText.includes('complimentary')) {
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

    return { time, price }
  } catch (error) {
    console.error(`Error fetching event details from ${eventUrl}:`, error)
    return null
  }
}

export const mapScraper: EventScraper = {
  id: 'map',
  name: 'MAP (Museum of Art & Photography)',
  website: 'https://map-india.org',
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      // Try the main "what's on" page which might have better static content
      const urls = [
        'https://map-india.org/whats-on/',
        'https://map-india.org/events/',
      ]

      const events: ScraperResult['events'] = []

      for (const url of urls) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          })

          if (!response.ok) {
            continue
          }

          const html = await response.text()
          const $ = cheerio.load(html)

          // Try many different possible selectors
          const eventSelectors = [
            // WordPress Events Manager
            '.event-item',
            '.em-event',
            '.em-item',
            'article.event',
            '.type-event',
            '.em-event-list-item',
            // Generic event containers
            '[class*="event-card"]',
            '[class*="event-item"]',
            '[class*="event-list"] > *',
            // Grid/card layouts
            '.card',
            '.grid-item',
            '[class*="grid"] > article',
            '[class*="grid"] > div[class*="item"]',
            // Common WordPress post types
            'article',
            '.post',
            '.entry',
            // MAP specific (guessing based on museum sites)
            '[class*="exhibition"]',
            '[class*="program"]',
            '[class*="activity"]',
          ]

          for (const selector of eventSelectors) {
            const $items = $(selector)

            if ($items.length > 0) {
              // Collect basic event info first (synchronously)
              const eventPromises: Promise<any>[] = []

              $items.each((idx, element) => {
                const $item = $(element)

                // Extract title - try many possibilities
                let title = ''
                const titleSelectors = [
                  'h1',
                  'h2',
                  'h3',
                  'h4',
                  '.title',
                  '.event-title',
                  '.em-event-title',
                  '.entry-title',
                  '[class*="title"]',
                  'a[class*="title"]',
                ]

                for (const tsel of titleSelectors) {
                  title = $item.find(tsel).first().text().trim()
                  if (title && title.length > 3) break
                }

                // If still no title, try the first heading or strong text
                if (!title) {
                  title = $item.find('h1, h2, h3, h4, strong').first().text().trim()
                }

                // Extract link
                let link = ''
                link = $item.find('a').first().attr('href') || ''
                if (!link) link = $item.attr('href') || ''
                if (link && !link.startsWith('http')) {
                  link = link.startsWith('/')
                    ? `https://map-india.org${link}`
                    : `https://map-india.org/${link}`
                }

                // Extract date - try many possibilities
                let date = ''
                const dateSelectors = [
                  'time',
                  '.date',
                  '.event-date',
                  '.em-event-date',
                  '[class*="date"]',
                  '[datetime]',
                ]

                for (const dsel of dateSelectors) {
                  const $dateEl = $item.find(dsel).first()
                  date = $dateEl.attr('datetime') || $dateEl.text().trim()
                  if (date) break
                }

                // Extract description
                let description = ''
                const descSelectors = [
                  'p',
                  '.description',
                  '.excerpt',
                  '.summary',
                  '[class*="description"]',
                ]

                for (const psel of descSelectors) {
                  description = $item.find(psel).first().text().trim()
                  if (description && description.length > 10) break
                }

                // Extract image
                let image = ''
                const $img = $item.find('img').first()
                image = $img.attr('src') || $img.attr('data-src') || ''
                if (image && !image.startsWith('http')) {
                  if (image.startsWith('//')) {
                    image = `https:${image}`
                  } else if (image.startsWith('/')) {
                    image = `https://map-india.org${image}`
                  }
                }

                // Only add if we have meaningful content
                if (
                  title &&
                  title.length > 3 &&
                  link &&
                  !title.toLowerCase().includes('view more') &&
                  !title.toLowerCase().includes('explore more')
                ) {
                  const eventDescription = description || 'Visit the website for more details'

                  // Create promise to fetch detailed information from individual event page
                  const eventPromise = (async () => {
                    let time = ''
                    let price = ''

                    if (link) {
                      const details = await fetchEventDetails(link)
                      if (details) {
                        time = details.time || ''
                        price = details.price || ''
                      }
                    }

                    return {
                      title,
                      date: date || 'Check website for dates',
                      time,
                      link,
                      description: eventDescription,
                      category: categorizeEvent(title, eventDescription),
                      image,
                      venue: 'Museum of Art & Photography',
                      price: price || undefined,
                      source: 'MAP',
                    }
                  })()

                  eventPromises.push(eventPromise)
                }
              })

              // Wait for all event details to be fetched (limit to prevent timeouts)
              // Only fetch details for first 20 events to keep response time reasonable
              const limitedPromises = eventPromises.slice(0, 20)
              const fetchedEvents = await Promise.all(limitedPromises)
              events.push(...fetchedEvents)

              // If we found events, no need to try more selectors
              if (events.length > 0) {
                break
              }
            }
          }

          // If we found events from this URL, stop trying other URLs
          if (events.length > 0) {
            break
          }
        } catch (urlError) {
          console.error(`MAP: Error fetching ${url}:`, urlError)
        }
      }

      return {
        events,
        metadata: {
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping MAP events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
