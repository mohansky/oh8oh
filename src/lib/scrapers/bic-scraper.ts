import * as cheerio from 'cheerio'
import { EventScraper, ScraperResult } from './types'
import { categorizeEvent } from '../utils/categorize-event'

export const bicScraper: EventScraper = {
  id: 'bic',
  name: 'Bangalore International Centre',
  website: 'https://bangaloreinternationalcentre.org',
  enabled: true,

  scrape: async (): Promise<ScraperResult> => {
    try {
      const events: ScraperResult['events'] = []
      let month = ''
      let year = ''

      // Scrape from main events page
      const mainPageResponse = await fetch(
        'https://bangaloreinternationalcentre.org/events/',
      )
      const mainPageHtml = await mainPageResponse.text()
      const $main = cheerio.load(mainPageHtml)

      // Extract events from list view
      $main('.event, .tribe-events-list-event-row, article[class*="event"]').each(
        (_, element) => {
          const $event = $main(element)

          // Try multiple selectors for title
          let title = $event
            .find('.tribe-events-list-event-title a')
            .text()
            .trim()
          if (!title)
            title = $event
              .find('h2 a, h3 a, .entry-title a')
              .first()
              .text()
              .trim()

          // Try multiple selectors for link
          let link =
            $event.find('.tribe-events-list-event-title a').attr('href') || ''
          if (!link)
            link =
              $event.find('h2 a, h3 a, .entry-title a').first().attr('href') ||
              ''

          // Extract date and time
          const dateTime = $event
            .find('.tribe-event-date-start, .tribe-events-event-meta time')
            .text()
            .trim()
          const time =
            $event
              .find('.tribe-events-event-meta-desc, .tribe-event-schedule-details')
              .text()
              .trim() ||
            dateTime ||
            'Time TBA'

          // Extract description
          const description = $event
            .find('.tribe-events-list-event-description, .entry-summary')
            .text()
            .trim()

          // Extract category
          const category = $event
            .find('.tribe-events-event-categories a, .event-category')
            .first()
            .text()
            .trim()

          // Extract image
          const image = $event.find('img').first().attr('src') || ''

          // Extract price
          let price = $event
            .find('.tribe-events-event-cost, .event-cost, .price, [class*="cost"], [class*="price"]')
            .first()
            .text()
            .trim()

          // Check event text for additional info
          const eventText = $event.text().toLowerCase()

          // Check for RSVP or registration requirements
          const hasRSVP = eventText.includes('rsvp') || eventText.includes('rsvp required')
          const hasRegistration = eventText.includes('registration required') ||
                                  eventText.includes('register') ||
                                  eventText.includes('registration')

          // If no price found, check if it's free or requires RSVP/registration
          if (!price) {
            if (eventText.includes('free') || eventText.includes('complimentary')) {
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

          if (title) {
            events.push({
              title,
              date: dateTime || 'Date TBA',
              time,
              link: link.startsWith('http')
                ? link
                : `https://bangaloreinternationalcentre.org${link}`,
              description,
              category: categorizeEvent(title, description, category),
              image,
              venue: 'Bangalore International Centre',
              price: price || undefined,
              source: 'BIC',
            })
          }
        },
      )

      // Scrape from calendar page for additional events
      const calendarResponse = await fetch(
        'https://bangaloreinternationalcentre.org/events/event-calendar/',
      )
      const calendarHtml = await calendarResponse.text()
      const $calendar = cheerio.load(calendarHtml)

      month = $calendar('.tribe-events-calendar-month__month-text')
        .text()
        .trim()
      year = $calendar('.tribe-events-calendar-month__year-text').text().trim()

      // Extract events from calendar cells
      $calendar('.tribe-events-calendar-month__calendar-event').each(
        (_, element) => {
          const $event = $calendar(element)
          const title = $event
            .find('.tribe-events-calendar-month__calendar-event-title')
            .text()
            .trim()
          const link = $event.attr('href') || ''

          // Get the parent day cell to find the date
          const $dayCell = $event.closest('.tribe-events-calendar-month__day')
          const day = $dayCell
            .find('.tribe-events-calendar-month__day-date')
            .text()
            .trim()

          // Extract time if available
          const time =
            $event
              .find('.tribe-events-calendar-month__calendar-event-datetime')
              .text()
              .trim() || 'Time TBA'

          // Get full date from data attribute or construct it
          const dateValue = $dayCell.attr('data-day') || ''

          // Extract price
          let calPrice = $event
            .find('.tribe-events-event-cost, .event-cost, .price, [class*="cost"]')
            .first()
            .text()
            .trim()

          // Check event text for additional info
          const calEventText = $event.text().toLowerCase()

          // Check for RSVP or registration requirements
          const calHasRSVP = calEventText.includes('rsvp') || calEventText.includes('rsvp required')
          const calHasRegistration = calEventText.includes('registration required') ||
                                      calEventText.includes('register') ||
                                      calEventText.includes('registration')

          if (!calPrice) {
            if (calEventText.includes('free') || calEventText.includes('complimentary')) {
              calPrice = 'Free'
            } else if (calHasRSVP) {
              calPrice = 'RSVP Required'
            } else if (calHasRegistration) {
              calPrice = 'Registration Required'
            }
          } else {
            // Add RSVP/registration info to existing price
            if (calHasRSVP) {
              calPrice += ' - RSVP Required'
            } else if (calHasRegistration) {
              calPrice += ' - Registration Required'
            }
          }

          if (title && !events.some((e) => e.title === title && e.link === link)) {
            events.push({
              title,
              date: dateValue || `${month} ${day}, ${year}`,
              time,
              link,
              description: '',
              category: categorizeEvent(title, ''),
              venue: 'Bangalore International Centre',
              price: calPrice || undefined,
              source: 'BIC',
            })
          }
        },
      )

      return {
        events,
        metadata: {
          month,
          year,
          venue: '7, 4th Main Road, Domlur II Stage, Bengaluru 560071',
          totalCount: events.length,
        },
      }
    } catch (error) {
      console.error('Error scraping BIC events:', error)
      return {
        events: [],
        metadata: {
          totalCount: 0,
        },
      }
    }
  },
}
