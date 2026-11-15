/**
 * Universal Date/Time Utilities
 * Handles various date and time formats from different event sources
 */

const MONTH_MAP: { [key: string]: number } = {
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
  let cleanedString = dateTimeString.replace(/(\d{4})(\d{1,2}:\d{2}\s*[ap]m)/gi, '$1 $2')

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

/**
 * Extract clean date without time
 * Returns formatted date string
 */
export function extractCleanDate(dateTimeString: string): string {
  if (!dateTimeString) return ''

  // Parse the date
  const date = parseEventDate(dateTimeString)
  if (!date) return dateTimeString

  // Format as "Day, Month DD, YYYY" (e.g., "Thursday, Nov 07, 2025")
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat']
  const months = [
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

  const dayName = days[date.getDay()]
  const monthName = months[date.getMonth()]
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${dayName}, ${monthName} ${day}, ${year}`
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

/**
 * Check if an event is in the future
 */
export function isUpcomingEvent(dateString: string): boolean {
  const eventDate = parseEventDate(dateString)
  if (!eventDate) return true // Keep events with no date

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return eventDate >= today
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
 * Compare two event dates for sorting (earliest first)
 */
export function compareEventDates(dateA: string, dateB: string): number {
  const parsedA = parseEventDate(dateA)
  const parsedB = parseEventDate(dateB)

  // Events with no date go to the end
  if (!parsedA && !parsedB) return 0
  if (!parsedA) return 1
  if (!parsedB) return -1

  return parsedA.getTime() - parsedB.getTime()
}

/**
 * Compare two events by date and time for sorting (earliest first)
 * First sorts by date, then by start time within the same date
 */
export function compareEventDateTimes(
  eventA: { date: string; time: string },
  eventB: { date: string; time: string }
): number {
  const parsedDateA = parseEventDate(eventA.date)
  const parsedDateB = parseEventDate(eventB.date)

  // Events with no date go to the end
  if (!parsedDateA && !parsedDateB) return 0
  if (!parsedDateA) return 1
  if (!parsedDateB) return -1

  // Compare dates first
  const dateComparison = parsedDateA.getTime() - parsedDateB.getTime()
  if (dateComparison !== 0) return dateComparison

  // Dates are equal, now compare times
  // Extract time from event.time or from date string
  const timeA = eventA.time || extractTime(eventA.date)
  const timeB = eventB.time || extractTime(eventB.date)

  const parsedTimeA = parseEventTime(timeA)
  const parsedTimeB = parseEventTime(timeB)

  // Events with no time go to the end within the same date
  if (parsedTimeA === null && parsedTimeB === null) return 0
  if (parsedTimeA === null) return 1
  if (parsedTimeB === null) return -1

  return parsedTimeA - parsedTimeB
}

/**
 * Check if an event is today
 */
export function isToday(dateString: string): boolean {
  const eventDate = parseEventDate(dateString)
  if (!eventDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return eventDate >= today && eventDate < tomorrow
}

/**
 * Check if an event is tomorrow
 */
export function isTomorrow(dateString: string): boolean {
  const eventDate = parseEventDate(dateString)
  if (!eventDate) return false

  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dayAfterTomorrow = new Date(tomorrow)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

  return eventDate >= tomorrow && eventDate < dayAfterTomorrow
}

/**
 * Check if an event is on the coming weekend (next Saturday and Sunday)
 */
export function isWeekend(dateString: string): boolean {
  const eventDate = parseEventDate(dateString)
  if (!eventDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Only show upcoming events
  if (eventDate < today) return false

  const todayDayOfWeek = today.getDay()

  // Calculate the next Saturday
  let daysUntilSaturday = 6 - todayDayOfWeek // Saturday = 6
  if (daysUntilSaturday < 0) daysUntilSaturday += 7

  // If today is Sunday (0), we want next Saturday (6 days away)
  if (todayDayOfWeek === 0) {
    daysUntilSaturday = 6
  }

  const nextSaturday = new Date(today)
  nextSaturday.setDate(today.getDate() + daysUntilSaturday)

  const nextSunday = new Date(nextSaturday)
  nextSunday.setDate(nextSaturday.getDate() + 1)

  const mondayAfterWeekend = new Date(nextSunday)
  mondayAfterWeekend.setDate(nextSunday.getDate() + 1)

  // Event must be on the coming Saturday or Sunday
  return eventDate >= nextSaturday && eventDate < mondayAfterWeekend
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
