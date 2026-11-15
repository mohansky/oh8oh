// Calendar utility functions

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  dayNumber: number
}

export function getMonthCalendar(year: number, month: number): Array<Array<CalendarDay>> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get the day of week for first day (0 = Sunday)
  const firstDayOfWeek = firstDay.getDay()

  // Calculate days from previous month to show
  const daysFromPrevMonth = firstDayOfWeek
  const prevMonthLastDay = new Date(year, month, 0)
  const prevMonthDays = prevMonthLastDay.getDate()

  const weeks: Array<Array<CalendarDay>> = []
  let currentWeek: Array<CalendarDay> = []

  // Add days from previous month
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const date = new Date(year, month - 1, day)
    date.setHours(0, 0, 0, 0)
    currentWeek.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      dayNumber: day,
    })
  }

  // Add days from current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    currentWeek.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      dayNumber: day,
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // Add days from next month to complete the last week
  if (currentWeek.length > 0) {
    let day = 1
    while (currentWeek.length < 7) {
      const date = new Date(year, month + 1, day)
      date.setHours(0, 0, 0, 0)
      currentWeek.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        dayNumber: day,
      })
      day++
    }
    weeks.push(currentWeek)
  }

  return weeks
}

export function getMonthName(month: number): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return monthNames[month]
}

export function getDayName(day: number): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return dayNames[day]
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * A key for one calendar day, built from the date's local parts.
 * (Not toISOString(): that converts to UTC first, which in IST turns local
 * midnight into the previous day.)
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Events running longer than this show on their first and last day only. */
const MAX_DAYS_SHOWN_IN_FULL = 14

/**
 * The calendar days an event should appear on. A short multi-day event shows
 * on every day it runs; a long run (a two-month exhibition) would fill the
 * whole grid, so it shows only where it opens and closes.
 */
export function calendarDaysFor(start: Date, end: Date): Array<Date> {
  const days: Array<Date> = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  while (cursor <= end && days.length <= MAX_DAYS_SHOWN_IN_FULL) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  if (days.length > MAX_DAYS_SHOWN_IN_FULL) return [start, end]
  return days
}
