import { describe, expect, it } from 'vitest'
import {
  compareEventDateTimes,
  extractCleanDate,
  getEventDates,
  hasEventEnded,
  inferEventYear,
  isToday,
  isTomorrow,
  isWeekend,
  parseEventDate,
  parseEventEndDate,
} from './date-time'

// Build an instant from a Bangalore wall-clock time, so the tests read in IST
// and pass regardless of the timezone of the machine running them.
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`)

const ymd = (date: Date | null) =>
  date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]

describe('parseEventDate', () => {
  it('reads the formats the scrapers produce', () => {
    expect(ymd(parseEventDate('Sat 14 Nov 2026'))).toEqual([2026, 11, 14])
    expect(ymd(parseEventDate('Saturday, Nov 14 2026'))).toEqual([2026, 11, 14])
    expect(ymd(parseEventDate('November 14, 2026'))).toEqual([2026, 11, 14])
    expect(ymd(parseEventDate('06 Nov 2026, 4:00 pm – 7:00 pm'))).toEqual([2026, 11, 6])
  })

  it('reads BIC dates where the time is glued to the year', () => {
    expect(ymd(parseEventDate('Tue, 24 Mar 20266:30 pm — 8:00 pm'))).toEqual([2026, 3, 24])
  })

  it('reads the four-letter "Sept" abbreviation', () => {
    expect(ymd(parseEventDate('13 Sept 2026, 6:00 pm – 8:30 pm'))).toEqual([2026, 9, 13])
  })

  it('returns null when there is no date', () => {
    expect(parseEventDate('Check website for dates')).toBeNull()
    expect(parseEventDate('')).toBeNull()
  })
})

describe('parseEventEndDate', () => {
  it('returns the end of a date range', () => {
    expect(ymd(parseEventEndDate('Jul 16 - Jul 30 2026'))).toEqual([2026, 7, 30])
    expect(ymd(parseEventEndDate('Aug 15, 2026 - Nov 1, 2026'))).toEqual([2026, 11, 1])
    expect(ymd(parseEventEndDate('Dec 28 2026 - Jan 3 2027'))).toEqual([2027, 1, 3])
  })

  it('does not mistake a time range for a date range', () => {
    expect(ymd(parseEventEndDate('06 Nov 2026, 4:00 pm – 7:00 pm'))).toEqual([2026, 11, 6])
  })

  it('matches parseEventDate for a single day', () => {
    expect(ymd(parseEventEndDate('Sat 14 Nov 2026'))).toEqual([2026, 11, 14])
  })
})

describe('hasEventEnded', () => {
  const now = ist('2026-11-15T10:00')

  it('is true for a past day and false for today or later', () => {
    expect(hasEventEnded('Sat 14 Nov 2026', now)).toBe(true)
    expect(hasEventEnded('Sun 15 Nov 2026', now)).toBe(false)
    expect(hasEventEnded('Mon 16 Nov 2026', now)).toBe(false)
  })

  it('keeps an event listed through the whole of its day', () => {
    expect(hasEventEnded('Sun 15 Nov 2026', ist('2026-11-15T23:59'))).toBe(false)
    expect(hasEventEnded('Sun 15 Nov 2026', ist('2026-11-16T00:01'))).toBe(true)
  })

  it('uses Bangalore time, not UTC, around midnight', () => {
    // 00:30 IST on the 15th is still the 14th in UTC.
    expect(hasEventEnded('Sat 14 Nov 2026', ist('2026-11-15T00:30'))).toBe(true)
  })

  it('judges a range by its end date', () => {
    expect(hasEventEnded('Jul 16 - Jul 30 2026', now)).toBe(true)
    expect(hasEventEnded('Nov 10 - Nov 30 2026', now)).toBe(false)
  })

  it('never treats an undated event as ended', () => {
    expect(hasEventEnded('Check website for dates', now)).toBe(false)
  })
})

describe('isToday / isTomorrow', () => {
  const now = ist('2026-11-15T00:30') // a Sunday

  it('matches the Bangalore calendar day', () => {
    expect(isToday('Sun 15 Nov 2026', now)).toBe(true)
    expect(isToday('Sat 14 Nov 2026', now)).toBe(false)
    expect(isTomorrow('Mon 16 Nov 2026', now)).toBe(true)
    expect(isTomorrow('Sun 15 Nov 2026', now)).toBe(false)
  })

  it('is false for undated events', () => {
    expect(isToday('Check website for dates', now)).toBe(false)
    expect(isTomorrow('Check website for dates', now)).toBe(false)
  })
})

describe('isWeekend', () => {
  it('on a weekday, means the coming Saturday and Sunday', () => {
    const wednesday = ist('2026-11-11T10:00')
    expect(isWeekend('Sat 14 Nov 2026', wednesday)).toBe(true)
    expect(isWeekend('Sun 15 Nov 2026', wednesday)).toBe(true)
    expect(isWeekend('Fri 13 Nov 2026', wednesday)).toBe(false)
    expect(isWeekend('Sat 21 Nov 2026', wednesday)).toBe(false)
  })

  it('on a Saturday, means today and tomorrow', () => {
    const saturday = ist('2026-11-14T10:00')
    expect(isWeekend('Sat 14 Nov 2026', saturday)).toBe(true)
    expect(isWeekend('Sun 15 Nov 2026', saturday)).toBe(true)
  })

  it('on a Sunday, means today only', () => {
    const sunday = ist('2026-11-15T10:00')
    expect(isWeekend('Sun 15 Nov 2026', sunday)).toBe(true)
    expect(isWeekend('Sat 21 Nov 2026', sunday)).toBe(false)
  })
})

describe('inferEventYear', () => {
  const now = ist('2026-11-15T10:00')

  it('uses this year for dates still ahead', () => {
    expect(inferEventYear(11, 5, now)).toBe(2026) // 5 Dec
  })

  it('uses next year for dates long past', () => {
    expect(inferEventYear(2, 20, now)).toBe(2027) // 20 Mar
  })

  it('keeps a recently finished event in this year', () => {
    expect(inferEventYear(10, 14, now)).toBe(2026) // 14 Nov, yesterday
    expect(inferEventYear(9, 18, now)).toBe(2026) // 18 Oct, four weeks ago
  })

  it('reads late December as last year when seen in early January', () => {
    expect(inferEventYear(11, 30, ist('2027-01-02T10:00'))).toBe(2026)
  })
})

describe('getEventDates', () => {
  it('gives a single day the same start and end', () => {
    const dates = getEventDates('Sat 14 Nov 2026')
    expect(ymd(dates!.start)).toEqual([2026, 11, 14])
    expect(ymd(dates!.end)).toEqual([2026, 11, 14])
  })

  it('lends the end year to a start that has none', () => {
    const dates = getEventDates('Oct 18 - Dec 20 2026')
    expect(ymd(dates!.start)).toEqual([2026, 10, 18])
    expect(ymd(dates!.end)).toEqual([2026, 12, 20])
  })

  it('puts the start in the previous year when the range crosses New Year', () => {
    const dates = getEventDates('Dec 28 - Jan 3 2027')
    expect(ymd(dates!.start)).toEqual([2026, 12, 28])
    expect(ymd(dates!.end)).toEqual([2027, 1, 3])
  })

  it('reads a range where both ends carry a year', () => {
    const dates = getEventDates('Sat, 05 Dec 2026 – Sun, 06 Dec 2026')
    expect(ymd(dates!.start)).toEqual([2026, 12, 5])
    expect(ymd(dates!.end)).toEqual([2026, 12, 6])
  })

  it('returns null for text with no date', () => {
    expect(getEventDates('Every Sun')).toBeNull()
    expect(getEventDates('Check website for dates')).toBeNull()
  })
})

describe('multi-day events in the day filters', () => {
  const now = ist('2026-11-15T10:00') // Sunday

  it('counts a running event as on today and tomorrow', () => {
    expect(isToday('Oct 18 - Dec 20 2026', now)).toBe(true)
    expect(isTomorrow('Oct 18 - Dec 20 2026', now)).toBe(true)
  })

  it('does not count an event that starts later', () => {
    expect(isToday('Nov 27 - Nov 28 2026', now)).toBe(false)
  })

  it('counts an event that overlaps the weekend', () => {
    const wednesday = ist('2026-11-11T10:00')
    expect(isWeekend('Nov 13 - Nov 14 2026', wednesday)).toBe(true)
    expect(isWeekend('Nov 9 - Nov 12 2026', wednesday)).toBe(false)
  })
})

describe('extractCleanDate', () => {
  it('formats a single day', () => {
    expect(extractCleanDate('Sat 14 Nov 2026')).toBe('Sat, Nov 14, 2026')
  })

  it('formats a range within one year', () => {
    expect(extractCleanDate('Oct 18 - Dec 20 2026')).toBe('Sun, Oct 18 – Sun, Dec 20, 2026')
  })

  it('formats a range across years with both years', () => {
    expect(extractCleanDate('Dec 28 - Jan 3 2027')).toBe('Mon, Dec 28, 2026 – Sun, Jan 03, 2027')
  })

  it('leaves undated text alone', () => {
    expect(extractCleanDate('Every Sun')).toBe('Every Sun')
  })
})

describe('compareEventDateTimes', () => {
  const now = ist('2026-11-15T10:00')
  const sorted = (events: Array<{ title: string; date: string; time: string }>) =>
    [...events].sort((a, b) => compareEventDateTimes(a, b, now)).map((e) => e.title)

  it('orders by day, then start time, with untimed events last in the day', () => {
    expect(
      sorted([
        { title: 'tomorrow', date: 'Mon 16 Nov 2026', time: '9:00 am' },
        { title: 'today untimed', date: 'Sun 15 Nov 2026', time: 'Time TBA' },
        { title: 'today evening', date: 'Sun 15 Nov 2026', time: '7:00 pm' },
        { title: 'today morning', date: 'Sun 15 Nov 2026', time: '11:00 am' },
      ]),
    ).toEqual(['today morning', 'today evening', 'today untimed', 'tomorrow'])
  })

  it('lists a running event under the day it ends', () => {
    expect(
      sorted([
        { title: 'tomorrow', date: 'Mon 16 Nov 2026', time: '9:00 am' },
        { title: 'running', date: 'Oct 18 - Dec 20 2026', time: '10:00 am' },
        { title: 'today', date: 'Sun 15 Nov 2026', time: '7:00 pm' },
      ]),
    ).toEqual(['today', 'tomorrow', 'running'])
  })

  it('puts undated events at the end', () => {
    expect(
      sorted([
        { title: 'undated', date: 'Every Sun', time: '12:00 PM' },
        { title: 'dated', date: 'Fri 25 Dec 2026', time: 'Time TBA' },
      ]),
    ).toEqual(['dated', 'undated'])
  })
})
