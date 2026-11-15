import { parseEventDateToDate } from './calendar'
import { generateEventFingerprint } from './event-fingerprint'
import type { Event } from '../scrapers/types'

// Generate ICS (iCalendar) file content for an event
export function generateICS(event: Event): string {
  const eventDate = parseEventDateToDate(event.date)

  if (!eventDate) {
    throw new Error('Invalid event date')
  }

  // Parse time if available
  const startDateTime = new Date(eventDate)
  let endDateTime = new Date(eventDate)

  if (event.time) {
    // Try to parse time (e.g., "7:00 PM", "19:00", etc.)
    const timeMatch = event.time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[2] || '0')
      const meridiem = timeMatch[3]?.toUpperCase()

      if (meridiem === 'PM' && hours !== 12) {
        hours += 12
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0
      }

      startDateTime.setHours(hours, minutes, 0, 0)
      // Default to 2 hour duration
      endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000)
    } else {
      // No time specified, make it all-day event
      endDateTime.setDate(endDateTime.getDate() + 1)
    }
  } else {
    // All-day event
    endDateTime.setDate(endDateTime.getDate() + 1)
  }

  // Format dates for ICS (YYYYMMDDTHHmmss or YYYYMMDD for all-day)
  const formatICSDate = (date: Date, allDay: boolean = false): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    if (allDay) {
      return `${year}${month}${day}`
    }

    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}`
  }

  const isAllDay = !event.time
  const now = new Date()

  // Escape special characters in ICS format
  const escapeICS = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  // Build ICS content
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//oh eight oh//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID(event)}`,
    `DTSTAMP:${formatICSDate(now)}`,
    isAllDay
      ? `DTSTART;VALUE=DATE:${formatICSDate(startDateTime, true)}`
      : `DTSTART:${formatICSDate(startDateTime)}`,
    isAllDay
      ? `DTEND;VALUE=DATE:${formatICSDate(endDateTime, true)}`
      : `DTEND:${formatICSDate(endDateTime)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ]

  if (event.description) {
    icsLines.push(`DESCRIPTION:${escapeICS(event.description)}`)
  }

  if (event.venue) {
    icsLines.push(`LOCATION:${escapeICS(event.venue)}`)
  }

  if (event.link) {
    icsLines.push(`URL:${event.link}`)
  }

  icsLines.push('END:VEVENT')
  icsLines.push('END:VCALENDAR')

  return icsLines.join('\r\n')
}

// Generate a unique identifier for the event
function generateUID(event: Event): string {
  const fingerprint = generateEventFingerprint(event)
  return `${fingerprint}@oh8oh.com`
}

// Download ICS file
export function downloadICS(event: Event): void {
  try {
    const icsContent = generateICS(event)
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Create filename from event title
    const filename = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
    link.download = filename

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to generate ICS file:', error)
    throw error
  }
}
