import { categorizeEvent } from '../utils/categorize-event'
import type { EventScraper, ScraperResult } from './types'

/**
 * Total Environment (Windmills Craftworks) exposes a public JSON API, so we hit
 * it directly instead of rendering the client-side React app with Puppeteer.
 *
 * Flow: GET token.json (public JWT, no credentials) → POST getEvents.json with
 * `Authorization: Bearer <token>` and body `{flag:"upcoming"}`. The response is
 * `result.data.music_events[]`, each with nested details/venues/dates/genres.
 *
 * Images: an event only carries a poster filename (`event_poster`). The
 * folder it lives in comes back in the same response as
 * `result.data.media_path`, and the landscape version sits under `Web/`
 * (`Mobile/` holds a portrait crop named by `mobile_image`).
 */
const API_BASE = 'https://api.total-environment.com/api/v1.0'
const SITE = 'https://www.total-environment.com'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export const totalEnvironmentScraper: EventScraper = {
  id: 'total-environment',
  name: 'Total Environment',
  website: SITE,
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: SITE,
      Referer: `${SITE}/`,
    }

    try {
      const events: ScraperResult['events'] = []

      // 1. Fetch the public bearer token
      const tokenRes = await fetch(`${API_BASE}/token.json`, { headers: commonHeaders })
      if (!tokenRes.ok) {
        console.log(`Total Environment: token fetch failed (HTTP ${tokenRes.status})`)
        return { events: [] }
      }
      const tokenJson: any = await tokenRes.json()
      const token = tokenJson?.data?.token
      if (!token) {
        console.log('Total Environment: no token in response')
        return { events: [] }
      }

      // 2. Fetch upcoming music events
      const eventsRes = await fetch(`${API_BASE}/getEvents.json`, {
        method: 'POST',
        headers: {
          ...commonHeaders,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flag: 'upcoming' }),
      })
      if (!eventsRes.ok) {
        console.log(`Total Environment: getEvents failed (HTTP ${eventsRes.status})`)
        return { events: [] }
      }
      const data: any = await eventsRes.json()
      const musicEvents: Array<any> = data?.result?.data?.music_events || []
      console.log(`Total Environment: API returned ${musicEvents.length} events`)

      const mediaPath: string = data?.result?.data?.media_path || ''
      const posterUrl = (fileName?: string) =>
        mediaPath && fileName
          ? `${mediaPath.replace(/\/?$/, '/')}Web/${encodeURIComponent(fileName)}`
          : ''

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (const ev of musicEvents) {
        const detail = ev.music_event_details?.[0] || {}
        const title: string = (detail.event_name || '').trim()
        if (!title) continue

        const description: string = (detail.event_description || '').trim()
        const genres: Array<string> = (ev.music_event_genres || [])
          .map((g: any) => g?.genre?.genre_name)
          .filter(Boolean)

        const priceParts: Array<string> = []
        if (ev.standing_ticket_price) priceParts.push(`Standing ₹${ev.standing_ticket_price}`)
        if (ev.seating_ticket_price) priceParts.push(`Seating ₹${ev.seating_ticket_price}`)
        const price = priceParts.join(' / ') || 'RSVP Required'

        const link = ev.url_slug ? `${SITE}/music-and-events/${ev.url_slug}` : `${SITE}/music-and-events`

        // Emit one event per (venue, upcoming concert date)
        for (const v of ev.music_event_venues || []) {
          // The API lists every city's shows (Hyderabad too). Keep venues in
          // Bangalore, and ones with no city given.
          const city: string = v.city?.city_name || ''
          if (city && !/^(bangalore|bengaluru)$/i.test(city.trim())) continue

          const venueName = v.restaurant_outlet?.outlet_name || v.other_venue || 'Total Environment'
          const venue = [venueName, v.area?.area_name, v.city?.city_name].filter(Boolean).join(', ')

          for (const dt of v.music_event_dates || []) {
            if (!dt.concert_date) continue
            const cd = new Date(dt.concert_date)
            if (isNaN(cd.getTime()) || cd < today) continue

            events.push({
              title,
              date: formatDate(dt.concert_date),
              time: (dt.start_time || '').trim() || 'Time TBA',
              link,
              description,
              category: categorizeEvent(title, `${description} ${genres.join(' ')}`),
              image: posterUrl(ev.event_poster),
              venue,
              price,
              source: 'Total Environment',
            })
          }
        }
      }

      console.log(`Total Environment: Successfully scraped ${events.length} events`)
      return {
        events,
        metadata: { totalCount: events.length },
      }
    } catch (error) {
      console.error('Error scraping Total Environment events:', error)
      return {
        events: [],
        metadata: { totalCount: 0 },
      }
    }
  },
}
