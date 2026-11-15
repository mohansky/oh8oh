import { describe, expect, it } from 'vitest'
import { parseDistrictDate, parseDistrictEvents } from './district-scraper'

const now = new Date('2026-11-15T10:00:00+05:30')

describe('parseDistrictDate', () => {
  it('adds the year to a single day and splits off the time', () => {
    expect(parseDistrictDate('Sun, 22 Nov, 6:00 PM', now)).toEqual({
      date: 'Sun, 22 Nov 2026',
      time: '6:00 PM',
    })
  })

  it('puts an early-year date in next year', () => {
    expect(parseDistrictDate('Sat, 20 Mar, 5:00 PM', now).date).toBe('Sat, 20 Mar 2027')
  })

  it('keeps a just-finished event in this year', () => {
    expect(parseDistrictDate('Sat, 14 Nov, 7:00 PM', now).date).toBe('Sat, 14 Nov 2026')
  })

  it('uses the weekday to settle the year', () => {
    // 12 Sep is a Saturday in 2026, not in 2027 — so this is a past event,
    // even though a guess from today's date alone would say 2027.
    expect(parseDistrictDate('Sat, 12 Sep – Sun, 13 Sep', now).date).toBe(
      'Sat, 12 Sep 2026 – Sun, 13 Sep 2026',
    )
  })

  it('reads a date range', () => {
    expect(parseDistrictDate('Sat, 05 Dec – Sun, 06 Dec, 1:00 PM', now)).toEqual({
      date: 'Sat, 05 Dec 2026 – Sun, 06 Dec 2026',
      time: '1:00 PM',
    })
  })

  it('rolls the end of a range over New Year', () => {
    expect(parseDistrictDate('Tue, 29 Dec – Sat, 02 Jan, 2:00 PM', now).date).toBe(
      'Tue, 29 Dec 2026 – Sat, 02 Jan 2027',
    )
  })

  it('keeps "Multiple slots" as the time', () => {
    expect(parseDistrictDate('Fri, 25 Dec – Sun, 27 Dec, Multiple slots', now).time).toBe(
      'Multiple slots',
    )
  })

  it('keeps a recurring schedule as the date text', () => {
    expect(parseDistrictDate('Every Sun, 12:00 PM to 4:00 PM', now)).toEqual({
      date: 'Every Sun',
      time: '12:00 PM – 4:00 PM',
    })
    expect(parseDistrictDate('Daily, 11:00 AM onwards', now)).toEqual({
      date: 'Daily',
      time: '11:00 AM onwards',
    })
  })
})

// The two card layouts District renders, reduced to the parts that matter.
const carouselCard = (o: { href: string; venue: string; title: string; date: string }) => `
  <a href="${o.href}"><div class="item-cards">
    <video poster="https://cdn.district.in/poster.png"></video>
    <div><svg></svg><span class="dds-text-secondary">${o.venue}</span></div>
    <span class="dds-text-primary">${o.title}</span>
    <span class="dds-text-secondary">${o.date}</span>
  </div></a>`

const listCard = (o: { href: string; venue: string; title: string; date: string; price: string }) => `
  <a href="${o.href}"><div class="item-cards">
    <span class="dds-text-quaternary">${o.date}</span>
    <h5 class="dds-text-primary">${o.title}</h5>
    <span class="dds-text-secondary">${o.venue}</span>
    <span class="dds-text-secondary">${o.price}</span>
  </div></a>`

describe('parseDistrictEvents', () => {
  const shreya = {
    href: 'https://www.district.in/events/shreya-ghoshal-buy-tickets',
    venue: 'Airtel Arena, Bengaluru',
    title: 'Shreya Ghoshal - The Unstoppable India Tour | Bengaluru',
    date: 'Sun, 22 Nov, 6:00 PM',
    price: '₹2500 onwards',
  }

  it('reads title, venue, date and price as separate fields', () => {
    const [event] = parseDistrictEvents(listCard(shreya), now)
    expect(event).toMatchObject({
      title: shreya.title,
      venue: 'Airtel Arena, Bengaluru',
      date: 'Sun, 22 Nov 2026',
      time: '6:00 PM',
      price: '₹2500 onwards',
      link: shreya.href,
      source: 'District',
    })
  })

  it('merges the carousel and list cards for the same event', () => {
    const events = parseDistrictEvents(carouselCard(shreya) + listCard(shreya), now)
    expect(events).toHaveLength(1)
    expect(events[0].image).toBe('https://cdn.district.in/poster.png')
    expect(events[0].price).toBe('₹2500 onwards')
  })

  it('reads the carousel layout on its own', () => {
    const [event] = parseDistrictEvents(carouselCard(shreya), now)
    expect(event).toMatchObject({
      title: shreya.title,
      venue: 'Airtel Arena, Bengaluru',
      date: 'Sun, 22 Nov 2026',
      price: 'Check website for price',
    })
  })

  it('reads "Free" as a price, not a venue', () => {
    const [event] = parseDistrictEvents(
      listCard({ ...shreya, venue: 'Toca | Koramangala, Bengaluru', price: 'Free' }),
      now,
    )
    expect(event.price).toBe('Free')
    expect(event.venue).toBe('Toca | Koramangala, Bengaluru')
  })

  it('skips events promoted from other cities', () => {
    const events = parseDistrictEvents(
      listCard({ ...shreya, href: '/events/home-festival', venue: 'Vagator, Goa' }),
      now,
    )
    expect(events).toHaveLength(0)
  })

  it('makes relative links absolute', () => {
    const [event] = parseDistrictEvents(listCard({ ...shreya, href: '/events/x' }), now)
    expect(event.link).toBe('https://www.district.in/events/x')
  })
})
