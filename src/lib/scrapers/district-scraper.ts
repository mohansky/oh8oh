import * as cheerio from 'cheerio'
import { MONTH_MAP, inferEventYear } from '../utils/date-time'
import { fetchRenderedHTML } from './browser-helper'
import type { EventScraper, ScraperResult } from './types'

type ScrapedEvent = ScraperResult['events'][number]

// "Sun, 22 Nov" — District never prints the year.
const DAY_MONTH = /([A-Za-z]{3}),\s+(\d{1,2})\s+([A-Za-z]{3,4})/g
// What a card's date line starts with: a dated day, or a recurring schedule.
const DATE_LINE = /^(?:[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}|Every\b|Daily\b)/i
const PRICE_LINE = /^(?:₹|Free\b)/i

// The Bengaluru listing also promotes big events elsewhere ("Vagator, Goa").
const OTHER_CITIES = new Set([
  'goa',
  'mumbai',
  'pune',
  'delhi',
  'new delhi',
  'gurugram',
  'gurgaon',
  'noida',
  'hyderabad',
  'chennai',
  'kolkata',
  'kochi',
  'jaipur',
  'ahmedabad',
  'chandigarh',
  'lucknow',
  'indore',
  'shillong',
  'guwahati',
])

/**
 * Turn District's date line into a date (with a year) and a time.
 *
 *   "Sun, 22 Nov, 6:00 PM"                      → one day
 *   "Sat, 05 Dec – Sun, 06 Dec, 1:00 PM"        → a range
 *   "Fri, 25 Dec – Sun, 27 Dec, Multiple slots" → a range, no single time
 *   "Every Sun, 12:00 PM to 4:00 PM"            → recurring: no calendar date
 *   "Daily, 11:00 AM onwards"                   → recurring: no calendar date
 *
 * Recurring events keep their schedule ("Every Sun") as the date text. It
 * isn't a parseable date, so the app treats them as undated and lists them
 * for as long as District does.
 */
export function parseDistrictDate(
  text: string,
  now: Date = new Date(),
): { date: string; time: string } {
  const line = text.trim()
  const days = [...line.matchAll(DAY_MONTH)]

  const cleanTime = (raw: string) =>
    raw
      .replace(/^[,\s]+/, '')
      .replace(/\s+to\s+/i, ' – ')
      .trim() || 'Time TBA'

  if (days.length === 0) {
    // Recurring: everything before the first comma is the schedule.
    const comma = line.indexOf(',')
    if (comma === -1) return { date: line || 'Check website for dates', time: 'Time TBA' }
    return {
      date: line.slice(0, comma).trim(),
      time: cleanTime(line.slice(comma)),
    }
  }

  const withYear = (match: RegExpMatchArray, year: number) =>
    `${match[1]}, ${match[2]} ${match[3]} ${year}`
  const monthOf = (match: RegExpMatchArray) =>
    MONTH_MAP[match[3].toLowerCase()] as number | undefined

  const first = days[0]
  const last = days[days.length - 1]
  const firstMonth = monthOf(first)
  const lastMonth = monthOf(last)
  const time = cleanTime(line.slice(last.index + last[0].length))

  if (firstMonth === undefined || lastMonth === undefined) {
    // Unknown month abbreviation — pass the text through rather than guess.
    return { date: line, time: 'Time TBA' }
  }

  const startYear = yearMatchingWeekday(
    first[1],
    firstMonth,
    parseInt(first[2]),
    inferEventYear(firstMonth, parseInt(first[2]), now),
  )
  if (days.length === 1) {
    return { date: withYear(first, startYear), time }
  }

  // A range that runs past New Year ends in the following year.
  const endYear = lastMonth < firstMonth ? startYear + 1 : startYear
  return {
    date: `${withYear(first, startYear)} – ${withYear(last, endYear)}`,
    time,
  }
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * District prints the weekday, which pins down the year far better than a
 * guess from today's date: "Sat, 12 Sep" is a Saturday in 2026 but not in
 * 2027. Start from the inferred year and take the nearest year whose calendar
 * agrees; if none does (unexpected text), keep the inferred one.
 */
function yearMatchingWeekday(
  weekday: string,
  monthIndex: number,
  day: number,
  inferredYear: number,
): number {
  const wanted = WEEKDAYS.indexOf(weekday.toLowerCase())
  if (wanted === -1) return inferredYear
  for (const year of [inferredYear, inferredYear - 1, inferredYear + 1]) {
    if (new Date(Date.UTC(year, monthIndex, day)).getUTCDay() === wanted) {
      return year
    }
  }
  return inferredYear
}

function isOutsideBengaluru(venue: string): boolean {
  const city = venue.split(',').pop()?.trim().toLowerCase() ?? ''
  return OTHER_CITIES.has(city)
}

/**
 * Extract events from the District listing HTML.
 *
 * The page renders each event up to twice, in two card layouts — a carousel
 * card (venue, title, date; has the poster image) and a list card (date,
 * title, venue, price). Each field is its own element, so read them
 * individually and merge the two cards for the same link. Reading the card's
 * text as one string glues the fields together ("…Raag MehfilDr. Ambedkar
 * Bhavan") and only works when the date happens to come first.
 */
export function parseDistrictEvents(
  html: string,
  now: Date = new Date(),
): Array<ScrapedEvent> {
  const $ = cheerio.load(html)

  interface Card {
    title: string
    dateLine: string
    venue: string
    price: string
    image: string
  }
  const byLink = new Map<string, Card>()

  $('.item-cards').each((_, element) => {
    const $card = $(element)
    const href = $card.closest('a').attr('href')
    if (!href) return
    const link = href.startsWith('http') ? href : `https://www.district.in${href}`

    const card: Card = { title: '', dateLine: '', venue: '', price: '', image: '' }

    // The title is the one "primary" text element (a span or an h5).
    card.title = $card.find('.dds-text-primary, h5').first().text().trim()

    $card.find('span').each((_i, span) => {
      const $span = $(span)
      if ($span.hasClass('dds-text-primary')) return
      const text = $span.text().trim()
      if (!text) return
      if (PRICE_LINE.test(text)) card.price ||= text
      else if (DATE_LINE.test(text)) card.dateLine ||= text
      else card.venue ||= text
    })

    const background = $card
      .html()
      ?.match(/background-image:\s*url\(['"&]*(https:\/\/[^'"&)]+)/)
    card.image =
      $card.find('video').first().attr('poster') ||
      $card.find('img').first().attr('src') ||
      $card.find('img').first().attr('data-src') ||
      background?.[1] ||
      ''

    // Fill in whatever the other card for this event didn't have.
    const existing = byLink.get(link)
    if (!existing) {
      byLink.set(link, card)
      return
    }
    existing.title ||= card.title
    existing.dateLine ||= card.dateLine
    existing.venue ||= card.venue
    existing.price ||= card.price
    existing.image ||= card.image
  })

  const events: Array<ScrapedEvent> = []
  for (const [link, card] of byLink) {
    if (card.title.length < 3) continue
    if (isOutsideBengaluru(card.venue)) continue

    const { date, time } = card.dateLine
      ? parseDistrictDate(card.dateLine, now)
      : { date: 'Check website for dates', time: 'Time TBA' }

    events.push({
      title: card.title,
      date,
      time,
      link,
      description: '',
      category: 'Music',
      image: card.image,
      venue: card.venue || 'Check event website',
      price: card.price || 'Check website for price',
      source: 'District',
    })
  }

  return events
}

export const districtScraper: EventScraper = {
  id: 'district',
  name: 'District',
  website: 'https://www.district.in',
  enabled: true,
  priority: 'low', // Uses Puppeteer, so low priority

  scrape: async (env?: any): Promise<ScraperResult> => {
    try {
      // Fetch the music events page for Bengaluru using Puppeteer
      const url = 'https://www.district.in/events/music-in-bengaluru-book-tickets'
      console.log(`🎵 Fetching District music events from ${url}...`)

      const html = await fetchRenderedHTML(env?.BROWSER, url, {
        waitUntil: 'networkidle2', // Wait for network requests to complete
        timeout: 45000, // Increased timeout for API calls
        waitAfterLoad: 2000, // Wait for React to render after data loads
        skipScroll: true, // Events load upfront
      })

      if (!html || html.length < 100) {
        console.log('District: Failed to fetch page content')
        return { events: [] }
      }

      const events = parseDistrictEvents(html)
      if (events.length === 0) {
        console.log('District: No events parsed from page')
      }
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
