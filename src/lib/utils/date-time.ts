/**
 * Universal Date/Time Utilities
 * Handles various date and time formats from different event sources
 */

export const MONTH_MAP: { [key: string]: number } = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8, // Sabha writes "13 Sept 2026"
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

/**
 * Parse date from various formats into a Date object
 */
export function parseEventDate(dateString: string): Date | null {
  if (!dateString) return null

  // Try standard date parsing first
  const standardDate = new Date(dateString)
  if (!isNaN(standardDate.getTime())) {
    return standardDate
  }

  // Handle format: "06 Nov 2025, 4:00 pm – 7:00 pm" (Sabha)
  // Handle format: "Sun 16 Nov 2025" (IHA)
  const dateMatch = dateString.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/)
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    const monthNum = MONTH_MAP[month.toLowerCase()]
    if (monthNum !== undefined) {
      return new Date(parseInt(year), monthNum, parseInt(day))
    }
  }

  return null
}

/**
 * Extract time from a date/time string
 * Returns time range or single time
 */
export function extractTime(dateTimeString: string): string {
  if (!dateTimeString) return ''

  // Clean up the string: add space after 4-digit years if followed by a time
  // This fixes BIC's format: "Fri, 7 Nov 20256:30 pm" -> "Fri, 7 Nov 2025 6:30 pm"
  const cleanedString = dateTimeString.replace(/(\d{4})(\d{1,2}:\d{2}\s*[ap]m)/gi, '$1 $2')

  // Match time patterns like:
  // "4:00 pm – 7:00 pm" or "06:00 PM – 07:30 PM"
  const timeRangeMatch = cleanedString.match(
    /(\d{1,2}:\d{2}\s*[ap]m)\s*[–—-]\s*(\d{1,2}:\d{2}\s*[ap]m)/i,
  )
  if (timeRangeMatch) {
    return `${timeRangeMatch[1]} – ${timeRangeMatch[2]}`
  }

  // Match single time like "4:00 pm" or "06:00 PM"
  const singleTimeMatch = cleanedString.match(/(\d{1,2}:\d{2}\s*[ap]m)/i)
  if (singleTimeMatch) {
    return singleTimeMatch[1]
  }

  return ''
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat']
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatDay(date: Date, withYear: boolean): string {
  const day = date.getDate().toString().padStart(2, '0')
  const text = `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${day}`
  return withYear ? `${text}, ${date.getFullYear()}` : text
}

/**
 * Extract a clean date without time, for display.
 * One day:  "Thur, Nov 07, 2025"
 * A range:  "Sat, Dec 05 – Sun, Dec 06, 2026"
 * Text with no date in it ("Every Sun") is returned unchanged.
 */
export function extractCleanDate(dateTimeString: string): string {
  if (!dateTimeString) return ''

  const dates = getEventDates(dateTimeString)
  if (!dates) return dateTimeString

  const { start, end } = dates
  if (start.getTime() === end.getTime()) return formatDay(start, true)

  const sameYear = start.getFullYear() === end.getFullYear()
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`
}

/**
 * Process event date and time fields
 * Returns separated, clean date and time
 */
export function processEventDateTime(event: {
  date: string
  time?: string
}): {
  cleanDate: string
  cleanTime: string
} {
  // If time is already separated and not in date
  if (event.time && !event.date.toLowerCase().includes('pm') && !event.date.toLowerCase().includes('am')) {
    return {
      cleanDate: extractCleanDate(event.date),
      cleanTime: event.time,
    }
  }

  // Time is embedded in date string (common in Sabha)
  const extractedTime = extractTime(event.date)
  const cleanDate = extractCleanDate(event.date)

  return {
    cleanDate,
    cleanTime: extractedTime || event.time || '',
  }
}

// Separator between the two halves of a date range: "Jul 16 - Jul 30 2026",
// "Aug 15, 2026 – Nov 1, 2026", "Jul 8 to Jul 12 2026".
const DATE_RANGE_SEPARATOR = /\s+[-–—]\s+|\s+to\s+/i
// A month name next to a day number, in either order ("Jul 30" / "30 Jul").
const MONTH_AND_DAY = /[A-Za-z]{3,9}\.?,?\s+\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}/

/** The first and last calendar day of an event, as local-midnight dates. */
export interface EventDates {
  start: Date
  end: Date
}

/**
 * The one place that turns a scraped date string into calendar days.
 * Everything that needs to know when an event is — filters, sorting, the
 * calendar, the .ics export, the displayed date — goes through this.
 *
 * A single-day event has start === end. For a range ("Oct 18 - Dec 20 2026",
 * "Sat, 05 Dec 2026 – Sun, 06 Dec 2026") the two differ. Returns null when
 * the text holds no date ("Every Sun", "Check website for dates").
 *
 * The right-hand side of a separator only counts as a date when it carries a
 * 4-digit year and a month+day, so a time range such as
 * "06 Nov 2025, 4:00 pm – 7:00 pm" is not mistaken for a date range.
 */
export function getEventDates(dateString: string): EventDates | null {
  if (!dateString) return null

  const parts = dateString.split(DATE_RANGE_SEPARATOR)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim()
    const end =
      /\d{4}/.test(last) && MONTH_AND_DAY.test(last) ? parseEventDate(last) : null

    if (end) {
      const first = parts[0].trim()
      let start: Date | null
      if (/\d{4}/.test(first)) {
        start = parseEventDate(first)
      } else {
        // "Oct 18 - Dec 20 2026": the start borrows the end's year, or the
        // year before when the range runs across New Year.
        start = parseEventDate(`${first} ${end.getFullYear()}`)
        if (start && start > end) {
          start = parseEventDate(`${first} ${end.getFullYear() - 1}`)
        }
      }
      return { start: start && start <= end ? start : end, end }
    }
  }

  const day = parseEventDate(dateString)
  return day ? { start: day, end: day } : null
}

/**
 * The last day of an event (the end of a range, or the day itself).
 */
export function parseEventEndDate(dateString: string): Date | null {
  return getEventDates(dateString)?.end ?? null
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toDayKey(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day
}

/**
 * Today's calendar date in Bangalore (IST), as a comparable number.
 * Computed from UTC so the answer is the same on the server (Workers run in
 * UTC) and in the browser, wherever either happens to be.
 */
function todayKeyIST(now: Date): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return toDayKey(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate())
}

/**
 * Pick the year for a date a source lists without one ("Sat, 20 Mar").
 *
 * Listings show upcoming events, so the date is normally this year or next.
 * A date that is a little in the past is still this year (sites keep events
 * up for a while after they happen) — only a date well behind us has to mean
 * next year. Rolling over the moment a date passes would stamp a just-finished
 * event with next year and keep it listed for twelve months.
 *
 * @param monthIndex 0 = January
 */
export function inferEventYear(
  monthIndex: number,
  day: number,
  now: Date = new Date(),
): number {
  const DAY = 24 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  const year = ist.getUTCFullYear()
  const today = Date.UTC(year, ist.getUTCMonth(), ist.getUTCDate())
  const candidate = Date.UTC(year, monthIndex, day)

  if (today - candidate > 60 * DAY) return year + 1
  // Early January looking at a late-December event that just happened.
  if (candidate - today > 300 * DAY) return year - 1
  return year
}

/**
 * True when the event's last day is before today in Bangalore.
 * Events whose date can't be parsed ("Check website for dates") are never
 * considered ended here — staleness for those is judged by when they were
 * last seen on the source site (see events-db).
 */
export function hasEventEnded(dateString: string, now: Date = new Date()): boolean {
  const dates = getEventDates(dateString)
  if (!dates) return false
  // Parsed event dates are wall-clock dates in the runtime's local zone, so
  // dateToDayKey reads them back with local getters.
  return dateToDayKey(dates.end) < todayKeyIST(now)
}

/**
 * Check if an event is in the future (or still running, for date ranges)
 */
export function isUpcomingEvent(dateString: string): boolean {
  return !hasEventEnded(dateString)
}

/**
 * Parse time string into minutes since midnight for comparison
 * Handles formats like "4:00 pm", "06:00 PM", "4:00 pm – 7:00 pm"
 * For time ranges, returns the start time
 */
export function parseEventTime(timeString: string): number | null {
  if (!timeString) return null

  // Extract the first time from a range (e.g., "4:00 pm – 7:00 pm" -> "4:00 pm")
  const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i)
  if (!timeMatch) return null

  const [, hours, minutes, period] = timeMatch
  let hour = parseInt(hours)
  const minute = parseInt(minutes)

  // Convert to 24-hour format
  if (period.toLowerCase() === 'pm' && hour !== 12) {
    hour += 12
  } else if (period.toLowerCase() === 'am' && hour === 12) {
    hour = 0
  }

  // Return total minutes since midnight
  return hour * 60 + minute
}


/**
 * Compare two events for the main list (soonest first).
 *
 * An event is placed on the day it starts. One that has already started (an
 * exhibition or a class series mid-run) is placed on the day it ends instead:
 * listing every running event under today would bury tomorrow's events —
 * on a typical day dozens of series are mid-run — and many of them only meet
 * on some days, so "today" would often be wrong anyway. Within a day: events
 * starting then come before ones closing then, then by start time, with
 * untimed events last. Undated events go to the very end.
 */
export function compareEventDateTimes(
  eventA: { date: string; time: string },
  eventB: { date: string; time: string },
  now: Date = new Date(),
): number {
  const datesA = getEventDates(eventA.date)
  const datesB = getEventDates(eventB.date)

  // Events with no date go to the end
  if (!datesA && !datesB) return 0
  if (!datesA) return 1
  if (!datesB) return -1

  const today = todayKeyIST(now)
  const startA = dateToDayKey(datesA.start)
  const startB = dateToDayKey(datesB.start)
  const runningA = startA < today ? 1 : 0
  const runningB = startB < today ? 1 : 0

  // The day each event is listed under: its start, or its end once running
  const dayA = runningA ? dateToDayKey(datesA.end) : startA
  const dayB = runningB ? dateToDayKey(datesB.end) : startB
  if (dayA !== dayB) return dayA - dayB

  // Same day: an event starting beats one closing
  if (runningA !== runningB) return runningA - runningB

  // Then by start time — from event.time, or embedded in the date string
  const parsedTimeA = parseEventTime(eventA.time || extractTime(eventA.date))
  const parsedTimeB = parseEventTime(eventB.time || extractTime(eventB.date))

  // Events with no time go to the end within the same date
  if (parsedTimeA === null && parsedTimeB === null) return 0
  if (parsedTimeA === null) return 1
  if (parsedTimeB === null) return -1

  return parsedTimeA - parsedTimeB
}

function dateToDayKey(date: Date): number {
  return toDayKey(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * True when the event is on at some point between two days (inclusive),
 * given as day keys. A multi-day event counts on every day it runs.
 */
function isOnBetween(dateString: string, fromKey: number, toKey: number): boolean {
  const dates = getEventDates(dateString)
  if (!dates) return false
  return dateToDayKey(dates.start) <= toKey && dateToDayKey(dates.end) >= fromKey
}

/**
 * Day key for the date `offsetDays` after today in Bangalore.
 */
function dayKeyFromTodayIST(offsetDays: number, now: Date): number {
  return todayKeyIST(new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000))
}

/**
 * Check if an event is on today (Bangalore time)
 */
export function isToday(dateString: string, now: Date = new Date()): boolean {
  const today = todayKeyIST(now)
  return isOnBetween(dateString, today, today)
}

/**
 * Check if an event is on tomorrow (Bangalore time)
 */
export function isTomorrow(dateString: string, now: Date = new Date()): boolean {
  const tomorrow = dayKeyFromTodayIST(1, now)
  return isOnBetween(dateString, tomorrow, tomorrow)
}

/**
 * Check if an event is on during the coming weekend (Bangalore time).
 * On a Saturday that means today and tomorrow; on a Sunday, just today;
 * otherwise the next Saturday and Sunday.
 */
export function isWeekend(dateString: string, now: Date = new Date()): boolean {
  // Day of week in Bangalore: 0 = Sunday … 6 = Saturday
  const dayOfWeek = new Date(now.getTime() + IST_OFFSET_MS).getUTCDay()
  if (dayOfWeek === 0) {
    const today = todayKeyIST(now)
    return isOnBetween(dateString, today, today)
  }

  const daysUntilSaturday = 6 - dayOfWeek
  return isOnBetween(
    dateString,
    dayKeyFromTodayIST(daysUntilSaturday, now),
    dayKeyFromTodayIST(daysUntilSaturday + 1, now),
  )
}

/**
 * Clean and validate a time string, removing any non-time content
 * Extracts only valid time formats and removes venue/category information
 *
 * @param timeString - Raw time string that may contain extra content
 * @returns Cleaned time string or empty string if no valid time found
 *
 * @example
 * cleanTimeString('08:00 PM Hip-Hop') // '08:00 PM'
 * cleanTimeString('6:00 pm - 8:00 pm at Venue') // '6:00 pm - 8:00 pm'
 * cleanTimeString('Music Event') // ''
 */
export function cleanTimeString(timeString: string): string {
  if (!timeString) return ''

  // First, extract time patterns before cleaning (to preserve "onwards")
  // 1. Time ranges: "6:00 pm - 8:00 pm" or "18:00 - 20:00"
  const timeRangePattern = /(\d{1,2}:\d{2}\s*(?:[ap]m)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:[ap]m)?)/i
  const rangeMatch = timeString.match(timeRangePattern)
  if (rangeMatch) {
    return `${rangeMatch[1].trim()} - ${rangeMatch[2].trim()}`
  }

  // 2. Single time with optional AM/PM and "onwards": "6:00 pm onwards" or "18:00 onwards"
  const singleTimePattern = /(\d{1,2}:\d{2})\s*([ap]m)?\s*(onwards)?/i
  const singleMatch = timeString.match(singleTimePattern)
  if (singleMatch) {
    const time = singleMatch[1]
    const ampm = singleMatch[2] ? ` ${singleMatch[2].toUpperCase()}` : ''
    const onwards = singleMatch[3] ? ' onwards' : ''
    return `${time}${ampm}${onwards}`.trim()
  }

  // 3. Special cases: "To Be Announced", "TBA", etc.
  const cleanedString = timeString
    .replace(/\b(Hip-Hop|Live Music|Music|Comedy|Theatre|Dance|Art|Workshop|Kids|Food|Literature|Heritage|Talk|Sports|Fitness)\b/gi, '')
    .replace(/\b(at|@|venue|location|Bangalore|Bengaluru|India)\b/gi, '')
    .replace(/INR|₹\d+/gi, '')
    .trim()

  if (/^(to\s+be\s+announced|tba|time\s+tba)$/i.test(cleanedString)) {
    return 'TBA'
  }

  // If no valid time pattern found, return empty string
  return ''
}

/**
 * Format time string according to user preference
 * Supports both 12-hour (with AM/PM) and 24-hour formats
 *
 * @param timeString - Time in 24-hour format (HH:mm) or time range
 * @param format - '12h' or '24h'
 * @returns Formatted time string
 *
 * @example
 * formatTime('18:00', '12h') // '6:00 PM'
 * formatTime('18:00', '24h') // '18:00'
 * formatTime('18:00 - 20:00', '12h') // '6:00 PM - 8:00 PM'
 */
export function formatTime(timeString: string, format: '12h' | '24h' = '12h'): string {
  if (!timeString) return ''

  // Helper to convert 12h with AM/PM to 24h
  const convert12hTo24h = (time12: string): string => {
    const ampmMatch = time12.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i)
    if (!ampmMatch) return time12

    const [, hours, minutes, period] = ampmMatch
    let hour24 = parseInt(hours)
    if (period.toLowerCase() === 'pm' && hour24 !== 12) {
      hour24 += 12
    } else if (period.toLowerCase() === 'am' && hour24 === 12) {
      hour24 = 0
    }
    return `${hour24.toString().padStart(2, '0')}:${minutes}`
  }

  // If format is 24h, convert any AM/PM times to 24h
  if (format === '24h') {
    // Handle time ranges
    const rangeMatch = timeString.match(/(.+?)\s*[-–—]\s*(.+)/)
    if (rangeMatch) {
      const [, startTime, endTime] = rangeMatch
      return `${convert12hTo24h(startTime.trim())} – ${convert12hTo24h(endTime.trim())}`
    }

    // Single time
    return convert12hTo24h(timeString)
  }

  // For 12h format, convert 24h times to 12h with AM/PM
  const convert24hTo12h = (time24: string): string => {
    // If it already has AM/PM, return as is
    if (/[ap]m/i.test(time24)) {
      return time24
    }

    const timeMatch = time24.match(/(\d{1,2}):(\d{2})/)
    if (!timeMatch) return time24

    const [, hours, minutes] = timeMatch
    let hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'

    // Convert to 12-hour format
    if (hour === 0) {
      hour = 12
    } else if (hour > 12) {
      hour -= 12
    }

    return `${hour}:${minutes} ${period}`
  }

  // Handle time ranges (e.g., "18:00 - 20:00" or "6:00 pm - 8:00 pm")
  const rangeMatch = timeString.match(/(.+?)\s*[-–—]\s*(.+)/)
  if (rangeMatch) {
    const [, startTime, endTime] = rangeMatch
    return `${convert24hTo12h(startTime.trim())} – ${convert24hTo12h(endTime.trim())}`
  }

  // Single time
  return convert24hTo12h(timeString)
}
