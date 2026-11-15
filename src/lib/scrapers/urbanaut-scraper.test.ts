import { describe, expect, it } from 'vitest'
import { parseUrbanautEvents } from './urbanaut-scraper'

const now = new Date('2026-11-15T10:00:00+05:30')

const card = (o: { slug: string; title: string; date: string; venue: string; price?: string }) => `
  <app-spot-card type="explore">
    <img src="assets/svg/loading.svg" class="carousel-image active">
    <a class="title-link" href="/spot/${o.slug}"><span class="pre-wrap">${o.title}</span></a>
    <div class="date-info"><span class="date-time">${o.date}</span></div>
    <span class="date-time">${o.venue}</span>
    <span class="price-text">${o.price ?? ''}</span>
  </app-spot-card>`

const page = (cards: string, spots: Array<Record<string, unknown>>) => `
  <html><body>${cards}
  <script id="ng-state" type="application/json">${JSON.stringify({ home_spot: spots })}</script>
  </body></html>`

const table = { slug: 'table-no-10', title: 'Table No. 10', date: 'Saturday, Nov 21', venue: 'Indiranagar', price: '₹1,200' }

describe('parseUrbanautEvents', () => {
  it('takes image, time and description from the embedded page data', () => {
    const [event] = parseUrbanautEvents(
      page(card(table), [
        {
          slug: 'table-no-10',
          photo_url: 'https://cdn.example/table.webp',
          start: '2026-11-21 19:00:00',
          end: '2026-11-21 22:00:00',
          multi_session: false,
          short_description_plain_text: '"Ten strangers.\\nOne table."',
        },
      ]),
      now,
    )
    expect(event).toMatchObject({
      title: 'Table No. 10',
      date: 'Saturday, Nov 21 2026',
      time: '7:00 PM – 10:00 PM',
      image: 'https://cdn.example/table.webp',
      description: 'Ten strangers. One table.',
      venue: 'Indiranagar',
      price: '₹1,200',
      link: 'https://urbanaut.app/spot/table-no-10',
      source: 'Urbanaut',
    })
  })

  it('gives a series its start time only', () => {
    const [event] = parseUrbanautEvents(
      page(card({ ...table, date: 'Nov 14 - Nov 22' }), [
        { slug: 'table-no-10', start: '2026-11-14 12:30:00', end: '2026-11-22 18:00:00', multi_session: true },
      ]),
      now,
    )
    expect(event.time).toBe('12:30 PM')
    expect(event.date).toBe('Nov 14 - Nov 22 2026')
  })

  it('builds the image URL from cover_img when photo_url is absent', () => {
    const [event] = parseUrbanautEvents(
      page(card(table), [{ slug: 'table-no-10', cover_img: 'images/abc.webp' }]),
      now,
    )
    expect(event.image).toBe('https://urbanaut-prod.s3.ap-south-1.amazonaws.com/images/abc.webp')
  })

  it('formats midnight and noon correctly', () => {
    const times = (start: string) =>
      parseUrbanautEvents(page(card(table), [{ slug: 'table-no-10', start, multi_session: true }]), now)[0].time
    expect(times('2026-11-21 00:15:00')).toBe('12:15 AM')
    expect(times('2026-11-21 12:00:00')).toBe('12:00 PM')
  })

  it('still lists the event when the embedded data is missing or broken', () => {
    const html = `<html><body>${card(table)}<script id="ng-state" type="application/json">{not json</script></body></html>`
    const [event] = parseUrbanautEvents(html, now)
    expect(event).toMatchObject({ title: 'Table No. 10', time: 'Time TBA', image: '', description: '' })
  })

  it('lists each link once', () => {
    expect(parseUrbanautEvents(page(card(table) + card(table), []), now)).toHaveLength(1)
  })
})
