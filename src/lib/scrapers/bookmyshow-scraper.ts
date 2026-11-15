import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { fetchRenderedHTML } from './puppeteer-helper'
import { categorizeEvent } from '../utils/categorize-event'

// Helper function to fetch details from individual BookMyShow event page
async function fetchBookMyShowEventDetails(eventUrl: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // Increased to 8 seconds

    const response = await fetch(eventUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`BookMyShow: Failed to fetch ${eventUrl}, status: ${response.status}`)
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    let venue = ''
    let date = ''
    let time = ''
    let price = ''

    console.log(`\n========================================`)
    console.log(`BookMyShow: Extracting from individual page`)
    console.log(`URL: ${eventUrl}`)
    console.log(`HTML length: ${html.length} chars`)

    // Log a sample of the page body text to see what's available
    const bodyText = $('body').text()
    console.log(`\n--- Page Text Sample (first 800 chars) ---`)
    console.log(bodyText.substring(0, 800))
    console.log(`--- End Sample ---\n`)

    // Try to find JSON-LD structured data first (most reliable for BookMyShow)
    let foundJsonLd = false
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonText = $(element).html()
        if (jsonText) {
          const data = JSON.parse(jsonText)

          // Extract from Event schema
          if (data['@type'] === 'Event' || data['@type']?.includes('Event')) {
            foundJsonLd = true
            console.log(`BookMyShow: Found Event JSON-LD for ${eventUrl}`)

            if (data.location?.name) {
              venue = data.location.name
              console.log(`  - Venue from JSON-LD: ${venue}`)
            }
            if (data.location?.address?.addressLocality && !venue) {
              venue = data.location.address.addressLocality
              console.log(`  - Venue from address: ${venue}`)
            }

            if (data.startDate) {
              date = data.startDate
              console.log(`  - Date from JSON-LD: ${date}`)
            }
            if (data.offers?.price) {
              price = `₹${data.offers.price}`
              console.log(`  - Price from JSON-LD: ${price}`)
            }
            if (data.offers?.lowPrice && !price) {
              price = `₹${data.offers.lowPrice}`
              console.log(`  - LowPrice from JSON-LD: ${price}`)
            }
          }
        }
      } catch (e) {
        // Invalid JSON, skip
        console.log(`BookMyShow: Failed to parse JSON-LD for ${eventUrl}`)
      }
    })

    if (!foundJsonLd) {
      console.log(`BookMyShow: No Event JSON-LD found for ${eventUrl}, trying HTML extraction`)
    }

    // Try to find event info cards/sections on the page
    console.log(`Searching for event info cards...`)
    const cardSelectors = [
      '[class*="EventInfo"]',
      '[class*="event-info"]',
      '[class*="eventInfo"]',
      '[class*="EventDetails"]',
      '[class*="event-details"]',
      '.event-card',
      '.info-card',
      '[class*="CardWrapper"]',
    ]

    for (const cardSelector of cardSelectors) {
      const $card = $(cardSelector).first()
      if ($card.length > 0) {
        const cardText = $card.text()
        console.log(`\n  Found card with selector: ${cardSelector}`)
        console.log(`  Card text (first 500 chars): ${cardText.substring(0, 500)}`)

        // Try to extract all info from this card
        if (!venue) {
          const venueMatch = cardText.match(/(?:Venue|Location|At)[\s:]+([^,\n]+(?:,\s*[^,\n]+)?)/i)
          if (venueMatch) {
            venue = venueMatch[1].trim()
            console.log(`  ✓ Venue from card: ${venue}`)
          }
        }

        if (!date) {
          const dateMatch = cardText.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i)
          if (dateMatch) {
            date = dateMatch[1]
            console.log(`  ✓ Date from card: ${date}`)
          }
        }

        if (!time) {
          const timeMatch = cardText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
          if (timeMatch) {
            time = timeMatch[1]
            console.log(`  ✓ Time from card: ${time}`)
          }
        }

        if (!price) {
          const priceMatch = cardText.match(/₹\s*(\d+(?:,\d+)?)/i)
          if (priceMatch) {
            price = `₹${priceMatch[1]}`
            console.log(`  ✓ Price from card: ${price}`)
          }
        }

        if (venue && date && price) {
          console.log(`  ✓ Got all data from card, skipping other selectors`)
          break
        }
      }
    }

    // Enhanced HTML extraction - try specific BookMyShow selectors
    if (!venue) {
      console.log(`Trying venue selectors...`)
      const venueSelectors = [
        '[class*="venue-name"]',
        '[class*="venue"]',
        '[class*="location"]',
        '[data-testid*="venue"]',
        '.venue',
        '.location',
      ]

      for (const selector of venueSelectors) {
        const venueText = $(selector).first().text().trim()
        if (venueText && venueText.length > 3 && venueText.length < 100) {
          venue = venueText
          console.log(`  ✓ Venue from selector ${selector}: ${venue}`)
          break
        }
      }
    }

    if (!date) {
      console.log(`Trying date selectors...`)
      const dateSelectors = [
        '[class*="event-date"]',
        '[class*="date"]',
        '[class*="show-date"]',
        '[data-testid*="date"]',
        'time[datetime]',
      ]

      for (const selector of dateSelectors) {
        const $dateEl = $(selector).first()
        const dateText = $dateEl.attr('datetime') || $dateEl.text().trim()
        if (dateText && dateText.length > 3) {
          date = dateText
          console.log(`  ✓ Date from selector ${selector}: ${date}`)
          break
        }
      }
    }

    if (!time) {
      console.log(`Trying time selectors...`)
      const timeSelectors = [
        '[class*="show-time"]',
        '[class*="event-time"]',
        '[class*="time"]',
      ]

      for (const selector of timeSelectors) {
        const timeText = $(selector).first().text().trim()
        if (timeText && timeText.match(/\d{1,2}:\d{2}/)) {
          time = timeText
          console.log(`  ✓ Time from selector ${selector}: ${time}`)
          break
        }
      }
    }

    if (!price) {
      console.log(`Trying price selectors...`)
      const priceSelectors = [
        '[class*="price"]',
        '[class*="amount"]',
        '[data-testid*="price"]',
        '.price',
      ]

      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim()
        if (priceText && (priceText.includes('₹') || priceText.match(/\d+/))) {
          price = priceText
          console.log(`  ✓ Price from selector ${selector}: ${price}`)
          break
        }
      }
    }

    // Final fallback: Pattern-based text extraction from entire page
    if (!venue || !date || !price) {
      const pageText = $('body').text()

      if (!venue) {
        const venuePatterns = [
          /(?:at|@)\s+([A-Z][A-Za-z\s&'-]+(?:Theatre|Theater|Center|Centre|Hall|Auditorium|Arena))/i,
          /Venue[:\s]+([A-Z][A-Za-z\s&'-]+)/i,
        ]
        for (const pattern of venuePatterns) {
          const match = pageText.match(pattern)
          if (match && match[1]) {
            venue = match[1].trim()
            console.log(`  - Venue from pattern: ${venue}`)
            break
          }
        }
      }

      if (!date) {
        const datePatterns = [
          /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
          /(\w+,\s+\d{1,2}\s+\w+\s+\d{4})/i,
          /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
        ]
        for (const pattern of datePatterns) {
          const match = pageText.match(pattern)
          if (match) {
            date = match[1]
            console.log(`  - Date from pattern: ${date}`)
            break
          }
        }
      }

      if (!price) {
        const priceMatch = pageText.match(/₹\s*(\d+(?:,\d+)?)/i)
        if (priceMatch) {
          price = `₹${priceMatch[1].replace(/,/g, '')}`
          console.log(`  - Price from pattern: ${price}`)
        } else if (pageText.toLowerCase().includes('free entry') || pageText.toLowerCase().includes('free admission')) {
          price = 'Free'
          console.log(`  - Price: Free`)
        }
      }
    }

    console.log(`BookMyShow: Final extracted data - Venue: ${venue}, Date: ${date}, Time: ${time}, Price: ${price}`)

    return { venue, date, time, price }
  } catch (error) {
    console.error(`BookMyShow: Error fetching details from ${eventUrl}:`, error)
    return null
  }
}

// Helper to parse date string into a Date object for sorting
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'Check website for dates') {
    return null
  }

  try {
    // Try ISO format first (from JSON-LD)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(dateStr)
    }

    // Try "DD Mon YYYY" format
    const match1 = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i)
    if (match1) {
      return new Date(`${match1[2]} ${match1[1]}, ${match1[3]}`)
    }

    // Try "Day, DD Month YYYY" format
    const match2 = dateStr.match(/\w+,\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i)
    if (match2) {
      return new Date(`${match2[2]} ${match2[1]}, ${match2[3]}`)
    }

    // Try direct parsing
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}

export const bookmyshowScraper: EventScraper = {
  id: 'bookmyshow',
  name: 'BookMyShow',
  website: 'https://in.bookmyshow.com',
  enabled: false,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const events: ScraperResult['events'] = []

      // Scrape both events and plays from Bangalore
      const urls = [
        'https://in.bookmyshow.com/explore/events-bengaluru',
        'https://in.bookmyshow.com/explore/plays-bengaluru',
      ]

      for (const url of urls) {
        try {
          // Use Puppeteer to render JavaScript-heavy BookMyShow pages
          console.log(`BookMyShow: Fetching ${url}...`)
          const html = await fetchRenderedHTML(url, {
            waitUntil: 'domcontentloaded', // Faster than networkidle
            timeout: 45000, // 45 seconds
            skipScroll: true, // Skip auto-scrolling for faster performance
          })

          if (!html || html.length < 100) {
            console.log(`BookMyShow: No content received from ${url}`)
            continue
          }

          const $ = cheerio.load(html)

          // Log how much HTML we got
          console.log(`BookMyShow: Received ${html.length} characters of HTML from ${url}`)

          // BookMyShow uses styled-components, so class names often have random hashes
          // Look for common patterns in their HTML structure
          const eventSelectors = [
            // Styled components patterns
            '[class*="style__StyledCard"]',
            '[class*="style__EventCard"]',
            '[class*="CardContainer"]',
            // Generic patterns
            'a[href*="/events/"]',
            'a[href*="/plays/"]',
            '[class*="event"]',
            '[class*="card"]',
            'article',
            // Data attributes
            '[data-testid*="event"]',
            '[data-testid*="card"]',
          ]

          for (const selector of eventSelectors) {
            const $items = $(selector)
            if ($items.length > 0) {
              console.log(`BookMyShow: Found ${$items.length} items with selector: ${selector}`)

              // Log the first item's HTML structure for debugging
              if ($items.length > 0) {
                const firstItemHtml = $($items[0]).html()
                console.log(`\n=== SAMPLE CARD HTML (first 500 chars) ===`)
                console.log(firstItemHtml?.substring(0, 500))
                console.log(`=== END SAMPLE ===\n`)
              }
            }

            if ($items.length > 0) {
              // Increased to 15 items to get more events
              const limitedItems = $items.slice(0, 15)

              // Collect event promises
              const eventPromises: Promise<any>[] = []

              limitedItems.each((_, element) => {
                const $item = $(element)

                // Extract title
                let title = ''
                const titleSelectors = ['h3', 'h2', 'h4', '[class*="title"]', '[class*="name"]']
                for (const tsel of titleSelectors) {
                  title = $item.find(tsel).first().text().trim()
                  if (title && title.length > 3) break
                }

                // Extract link
                let link = ''
                // Check if $item itself is an anchor tag
                if ($item.is('a')) {
                  link = $item.attr('href') || ''
                } else {
                  // Otherwise look for an anchor inside
                  link = $item.find('a').first().attr('href') || ''
                }

                if (link && !link.startsWith('http')) {
                  link = `https://in.bookmyshow.com${link.startsWith('/') ? '' : '/'}${link}`
                }

                console.log(`  Link extracted: ${link || 'NO LINK FOUND'}`)

                // Extract image - BookMyShow uses lazy loading
                let image = ''
                const $img = $item.find('img').first()
                const imageSrc =
                  $img.attr('src') ||
                  $img.attr('data-src') ||
                  $img.attr('data-lazy-src') ||
                  $img.attr('srcset')?.split(',')[0]?.split(' ')[0] ||
                  ''

                image = imageSrc

                // Extract date from BookMyShow image URL (they encode it in the ie- parameter)
                // Example: ie-U3VuLCA5IE5vdg%3D%3D decodes to "Sun, 9 Nov"
                let imageDate = ''
                if (imageSrc && imageSrc.includes('ie-')) {
                  try {
                    const ieMatch = imageSrc.match(/ie-([^,]+?)(?:,|$|:)/)
                    if (ieMatch) {
                      // URL decode and then base64 decode
                      const urlDecoded = decodeURIComponent(ieMatch[1])
                      const base64Decoded = Buffer.from(urlDecoded, 'base64').toString('utf-8')
                      imageDate = base64Decoded
                      console.log(`  ✓ Extracted date from image: ${imageDate}`)
                    }
                  } catch (e) {
                    // Ignore decode errors
                  }
                }

                // Clean up BookMyShow CDN URLs
                if (image && image.includes('bmscdn.com')) {
                  // Remove transformation parameters if present
                  image = image.split('?')[0]
                }

                // Extract genre/category from BookMyShow
                const genre = $item
                  .find('[class*="genre"], [class*="category"], [class*="tag"]')
                  .first()
                  .text()
                  .trim()

                // Try to extract date/venue/price from the listing card first
                let cardDate = imageDate // Start with date from image
                let cardVenue = ''
                let cardPrice = ''

                // Get all text from the card for pattern matching
                const cardText = $item.text()
                console.log(`\nProcessing: ${title}`)
                console.log(`Card text (first 400 chars): ${cardText.substring(0, 400)}`)
                console.log(`Full card text length: ${cardText.length} chars`)

                // Try to find date on the card using selectors (only if not found in image)
                if (!cardDate) {
                  const dateSelectors = [
                    '[class*="date"]',
                    '[class*="Date"]',
                    'time',
                    '[datetime]',
                  ]
                  for (const dsel of dateSelectors) {
                    const $dateEl = $item.find(dsel).first()
                    const dateText = $dateEl.attr('datetime') || $dateEl.text().trim()
                    if (dateText && dateText.length > 3 && !dateText.toLowerCase().includes('onwards')) {
                      cardDate = dateText
                      console.log(`  ✓ Found date on card: ${cardDate}`)
                      break
                    }
                  }
                }

                // Try to find venue on the card using selectors
                const venueSelectors = [
                  '[class*="venue"]',
                  '[class*="Venue"]',
                  '[class*="location"]',
                  '[class*="Location"]',
                ]
                for (const vsel of venueSelectors) {
                  const venueText = $item.find(vsel).first().text().trim()
                  if (venueText && venueText.length > 3 && venueText.length < 100) {
                    cardVenue = venueText
                    console.log(`  ✓ Found venue on card: ${cardVenue}`)
                    break
                  }
                }

                // Try to find price on the card using selectors
                const priceSelectors = [
                  '[class*="price"]',
                  '[class*="Price"]',
                  '[class*="amount"]',
                ]
                for (const psel of priceSelectors) {
                  const priceText = $item.find(psel).first().text().trim()
                  if (priceText && (priceText.includes('₹') || priceText.match(/\d+/))) {
                    cardPrice = priceText
                    console.log(`  ✓ Found price on card: ${cardPrice}`)
                    break
                  }
                }

                // Fallback: Extract from card text using patterns
                if (!cardVenue) {
                  // Remove the title from cardText to avoid matching it in patterns
                  // The title often appears at the start and sometimes repeats at the end
                  let textWithoutTitle = cardText
                  if (title) {
                    // Remove all occurrences of the title (case-insensitive)
                    const titleRegex = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
                    textWithoutTitle = cardText.replace(titleRegex, '')
                  }

                  // Look for venue patterns in the card text
                  // Pattern: "Venue Name: Location, Bengaluru" or "Venue Name: Bengaluru"
                  const venueKeywords = '(?:Theatre|Theater|Centre|Center|Hall|Auditorium|Arena|Kalakshetra|Convention Centre|Stadium|Ground|Club|Lounge|Cafe|Restaurant|Park|Garden|Mall|Hotel|Resort|City)'
                  const venuePatterns = [
                    // Match venue with location details (e.g., "Jagriti Theatre: Whitefield, Bengaluru")
                    new RegExp(`([A-Z][A-Za-z\\s&',-]+${venueKeywords}):\\s*([^₹\\n]+?),?\\s*Bengaluru`, 'i'),
                    // Match just the venue name before Bengaluru
                    new RegExp(`([A-Z][A-Za-z\\s&',-]+${venueKeywords}):\\s*Bengaluru`, 'i'),
                    // Match any capitalized name followed by colon and location (allow commas in venue name)
                    /([A-Z][A-Za-z\s&',-]+?):\s*([A-Za-z\s,]+?),?\s*Bengaluru/i,
                  ]

                  for (const pattern of venuePatterns) {
                    const match = textWithoutTitle.match(pattern)
                    if (match) {
                      // If we have location details (match[2]), include them
                      if (match[2] && match[2].trim() && !match[2].match(/concerts|comedy|dance|music|plays|stand\s*up/i)) {
                        cardVenue = `${match[1].trim()}: ${match[2].trim()}, Bengaluru`
                      } else {
                        cardVenue = `${match[1].trim()}: Bengaluru`
                      }
                      console.log(`  ✓ Extracted venue from text: ${cardVenue}`)
                      break
                    }
                  }
                }

                if (!cardDate) {
                  // Look for date patterns in the card text
                  const datePatterns = [
                    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?)/i,
                    /(\w{3},?\s+\d{1,2}\s+\w{3})/i,
                    // Time-based patterns for "Today", "Tomorrow", etc.
                    /(Today|Tomorrow|This\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*)/i,
                  ]
                  for (const pattern of datePatterns) {
                    const match = cardText.match(pattern)
                    if (match) {
                      cardDate = match[1]
                      console.log(`  ✓ Extracted date from text: ${cardDate}`)
                      break
                    }
                  }
                }

                if (!cardPrice) {
                  // Look for price in the text
                  const priceMatch = cardText.match(/₹\s*(\d+(?:,\d+)?)\s*(?:onwards)?/i)
                  if (priceMatch) {
                    cardPrice = `₹${priceMatch[1]}`
                    console.log(`  ✓ Extracted price from text: ${cardPrice}`)
                  }
                }

                // Only process if we have meaningful content
                if (title && title.length > 3 && !title.toLowerCase().includes('view all')) {
                  // Create promise to fetch detailed information from individual event page
                  const eventPromise = (async () => {
                    // Default values
                    let venue = 'Check event website'
                    let date = 'Check website for dates'
                    let time = ''
                    let price = 'Ticketed'

                    // ALWAYS fetch from individual page - more reliable than card data
                    console.log(`\n>>> About to fetch individual page`)
                    console.log(`>>> Title: "${title}"`)
                    console.log(`>>> Link: ${link || 'NO LINK'}`)
                    console.log(`>>> Link truthy: ${!!link}`)

                    if (link) {
                      console.log(`\n🔍 BookMyShow: NOW FETCHING individual page for "${title}"`)
                      console.log(`🔍 URL: ${link}\n`)
                      const details = await fetchBookMyShowEventDetails(link)
                      if (details) {
                        if (details.venue) venue = details.venue
                        if (details.date) date = details.date
                        if (details.time) time = details.time
                        if (details.price) price = details.price
                      } else {
                        console.log(`BookMyShow: Failed to fetch details for "${title}", using card data as fallback`)
                        // Fallback to card data if individual page fetch fails
                        if (cardVenue) venue = cardVenue
                        if (cardDate) date = cardDate
                        if (cardPrice) price = cardPrice
                      }
                    }

                    return {
                      title,
                      date,
                      time,
                      link: link || url,
                      description: genre || 'Visit BookMyShow for more details',
                      category: categorizeEvent(title, genre),
                      image,
                      venue,
                      price,
                      source: 'BookMyShow',
                    }
                  })()

                  eventPromises.push(eventPromise)
                }
              })

              // Wait for all event details to be fetched in parallel
              const fetchedEvents = await Promise.all(eventPromises)
              events.push(...fetchedEvents)

              // If we found events with this selector, no need to try others
              if (events.length > 0) {
                break
              }
            }
          }

          // If we found events from this URL, stop trying other URLs
          if (events.length > 0) {
            console.log(`BookMyShow: Successfully scraped ${events.length} events from ${url}`)
            break
          }
        } catch (urlError) {
          console.error(`BookMyShow: Error fetching ${url}:`, urlError)
        }
      }

      // Sort events by date - prioritize upcoming events
      const now = new Date()
      const sortedEvents = events.sort((a, b) => {
        const dateA = parseEventDate(a.date)
        const dateB = parseEventDate(b.date)

        // Events with no date go to the end
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1

        // Upcoming events (future or today) come first, sorted by date
        const isUpcomingA = dateA >= now
        const isUpcomingB = dateB >= now

        if (isUpcomingA && !isUpcomingB) return -1
        if (!isUpcomingA && isUpcomingB) return 1

        // Both upcoming or both past - sort by date (earliest first for upcoming, latest first for past)
        if (isUpcomingA && isUpcomingB) {
          return dateA.getTime() - dateB.getTime() // Earliest upcoming first
        } else {
          return dateB.getTime() - dateA.getTime() // Latest past first
        }
      })

      console.log(`BookMyShow: Sorted ${sortedEvents.length} events by date (upcoming events first)`)

      return {
        events: sortedEvents,
        metadata: {
          totalCount: sortedEvents.length,
        },
      }
    } catch (error) {
      console.error('Error scraping BookMyShow events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
