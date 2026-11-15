import * as cheerio from 'cheerio'
import { categorizeEvent } from '../utils/categorize-event'
import { MONTH_MAP, inferEventYear } from '../utils/date-time'
import type { EventScraper, ScraperResult } from './types'

type ScrapedEvent = ScraperResult['events'][number]

const SITE = 'https://urbanaut.app'
const IMAGE_BASE = 'https://urbanaut-prod.s3.ap-south-1.amazonaws.com/'
const MAX_DESCRIPTION_LENGTH = 1000

/**
 * The fields we use from one entry of the page's embedded data
 * (`<script id="ng-state">` → `home_spot[]`).
 */
interface Spot {
  slug?: string
  photo_url?: string
  cover_img?: string
  /** "2026-11-21 19:00:00", Bangalore wall-clock time */
  start?: string
  end?: string
  multi_session?: boolean
  short_description_plain_text?: string
}

/**
 * Urbanaut is an Angular Universal app. Its listing is server-rendered, so a
 * plain fetch is enough (no Puppeteer/BROWSER binding needed), and the page
 * also embeds the full data it was rendered from as JSON in
 * `<script id="ng-state">`.
 *
 * Title, date, venue, price and link are read from the rendered cards. The
 * image, start time and description are not in the cards (the image there is
 * a lazy-load placeholder), so those come from the embedded data, matched to
 * the card by the slug in its link.
 */
function readSpots($: cheerio.CheerioAPI): Map<string, Spot> {
  const spots = new Map<string, Spot>()
  try {
    const state = JSON.parse($('script#ng-state').text() || '{}')
    for (const spot of (state.home_spot ?? []) as Array<Spot>) {
      if (spot.slug) spots.set(spot.slug, spot)
    }
  } catch (error) {
    // The cards still give us everything except image/time/description.
    console.warn('Urbanaut: could not read embedded page data:', error)
  }
  return spots
}

/** "2026-11-21 19:00:00" → "7:00 PM" */
function clockTime(dateTime?: string): string {
  const match = dateTime?.match(/\s(\d{2}):(\d{2})/)
  if (!match) return ''
  const hours = parseInt(match[1])
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${match[2]} ${period}`
}

function spotTime(spot?: Spot): string {
  const start = clockTime(spot?.start)
  if (!start) return 'Time TBA'

  // For a single sitting, start and end are the same day and the end time is
  // meaningful. For a series, `end` is when the last session finishes, which
  // says nothing about the length of each one.
  const sameDay = spot?.start?.slice(0, 10) === spot?.end?.slice(0, 10)
  const end = clockTime(spot?.end)
  return !spot?.multi_session && sameDay && end && end !== start
    ? `${start} – ${end}`
    : start
}

function spotDescription(spot?: Spot): string {
  let text = spot?.short_description_plain_text ?? ''
  // The field holds a JSON-encoded string (wrapped in quotes, escaped).
  if (text.startsWith('"')) {
    try {
      text = JSON.parse(text)
    } catch {
      /* use it as it is */
    }
  }
  text = String(text).replace(/\s+/g, ' ').trim()
  return text.length > MAX_DESCRIPTION_LENGTH
    ? `${text.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}…`
    : text
}

function spotImage(spot?: Spot): string {
  if (spot?.photo_url) return spot.photo_url
  return spot?.cover_img ? IMAGE_BASE + spot.cover_img : ''
}

export function parseUrbanautEvents(
  html: string,
  now: Date = new Date(),
): Array<ScrapedEvent> {
  const $ = cheerio.load(html)
  const spots = readSpots($)
  const events: Array<ScrapedEvent> = []

  const $eventCards = $('app-spot-card[type="explore"]')
  console.log(`Urbanaut: Found ${$eventCards.length} event cards`)

  const seenLinks = new Set<string>()

  $eventCards.each((_, element) => {
    const $card = $(element)

    // Title + link
    const $titleLink = $card.find('a.title-link').first()
    const title = $titleLink.find('.pre-wrap').text().trim()
    let link = $titleLink.attr('href') || ''

    if (!title || title.length < 3 || !link) return

    if (!link.startsWith('http')) {
      link = link.startsWith('/') ? `${SITE}${link}` : `${SITE}/${link}`
    }

    if (seenLinks.has(link)) return
    seenLinks.add(link)

    // Date and venue are both rendered as <span class="date-time"> — the
    // first (inside .date-info) is the date, the second is the venue.
    const dateTimes = $card
      .find('span.date-time')
      .map((_i, s) => $(s).text().trim())
      .get()
      .filter(Boolean)
    let date = dateTimes[0] || ''
    const venue = dateTimes[1] || 'Check event website'

    // Add a year to dates like "Saturday, Jul 18" (Urbanaut omits it).
    // The year goes on the end, so for a range ("Oct 18 - Dec 20") it is
    // the END date's year that has to be right — infer from the last
    // "Mon DD" in the string.
    if (date && !/\d{4}/.test(date)) {
      const monthDays = [
        ...date.matchAll(
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/gi,
        ),
      ]
      const last = monthDays.at(-1)
      if (last) {
        const monthNum = MONTH_MAP[last[1].toLowerCase()]
        date = `${date} ${inferEventYear(monthNum, parseInt(last[2]), now)}`
      }
    }

    // Price
    let price = $card.find('.price-text').first().text().trim()
    if (!price) price = 'Check website for price'

    // Image, time and description from the embedded data for this card
    const slug = link.split('?')[0].split('/').filter(Boolean).pop() ?? ''
    const spot = spots.get(slug)
    const description = spotDescription(spot)

    events.push({
      title,
      date: date || 'Check website for dates',
      time: spotTime(spot),
      link,
      description,
      category: categorizeEvent(title, description),
      image: spotImage(spot),
      venue: venue || 'Check event website',
      price,
      source: 'Urbanaut',
    })
  })

  return events
}

export const urbanautScraper: EventScraper = {
  id: 'urbanaut',
  name: 'Urbanaut',
  website: SITE,
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const url = `${SITE}/experience-bengaluru/events`
      console.log(`🎪 Fetching Urbanaut events from ${url}...`)

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (!response.ok) {
        console.log(`Urbanaut: HTTP ${response.status}`)
        return { events: [] }
      }

      const events = parseUrbanautEvents(await response.text())
      console.log(`Urbanaut: Successfully scraped ${events.length} events`)

      return {
        events,
        metadata: { totalCount: events.length },
      }
    } catch (error) {
      console.error('Error scraping Urbanaut events:', error)
      return {
        events: [],
        metadata: { totalCount: 0 },
      }
    }
  },
}
