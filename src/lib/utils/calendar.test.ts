import { describe, expect, it } from 'vitest'
import { calendarDaysFor, dayKey } from './calendar'
import { generateICS } from './ics'

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05')
  })
})

describe('calendarDaysFor', () => {
  it('returns the one day of a single-day event', () => {
    const day = new Date(2026, 10, 14)
    expect(calendarDaysFor(day, day).map(dayKey)).toEqual(['2026-11-14'])
  })

  it('returns every day of a short run', () => {
    expect(
      calendarDaysFor(new Date(2026, 11, 30), new Date(2027, 0, 2)).map(dayKey),
    ).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('returns only the first and last day of a long run', () => {
    expect(
      calendarDaysFor(new Date(2026, 9, 18), new Date(2026, 11, 20)).map(dayKey),
    ).toEqual(['2026-10-18', '2026-12-20'])
  })
})

describe('generateICS', () => {
  const base = { title: 'Concert', link: 'https://example.com/a', source: 'BIC' }

  it('exports a timed single-day event with a two-hour default length', () => {
    const ics = generateICS({ ...base, date: 'Sat 14 Nov 2026', time: '7:00 PM' })
    expect(ics).toContain('DTSTART:20261114T190000')
    expect(ics).toContain('DTEND:20261114T210000')
  })

  it('exports an event with no usable time as all-day', () => {
    const ics = generateICS({ ...base, date: 'Sat 14 Nov 2026', time: 'Time TBA' })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261114')
    expect(ics).toContain('DTEND;VALUE=DATE:20261115')
  })

  it('exports a multi-day event across its whole run', () => {
    const ics = generateICS({ ...base, date: 'Oct 18 - Dec 20 2026', time: '10:00 am' })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261018')
    expect(ics).toContain('DTEND;VALUE=DATE:20261221')
  })

  it('reads dates the old calendar parser could not', () => {
    const ics = generateICS({ ...base, date: 'Tue, 24 Mar 20266:30 pm — 8:00 pm', time: '6:30 pm' })
    expect(ics).toContain('DTSTART:20260324T183000')
  })
})
