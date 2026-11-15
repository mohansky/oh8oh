// Calendar utility functions

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  dayNumber: number
}

export function getMonthCalendar(year: number, month: number): CalendarDay[][] {
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

  const weeks: CalendarDay[][] = []
  let currentWeek: CalendarDay[] = []

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

export function parseEventDateToDate(dateString: string): Date | null {
  // Parse date strings like "Fri 20 Dec", "20 Dec 2024", etc.
  try {
    const currentYear = new Date().getFullYear()

    // Try parsing with Date constructor
    let date = new Date(dateString)

    // If that doesn't work, try adding current year
    if (isNaN(date.getTime())) {
      date = new Date(`${dateString} ${currentYear}`)
    }

    // If still invalid, return null
    if (isNaN(date.getTime())) {
      return null
    }

    // Set time to midnight
    date.setHours(0, 0, 0, 0)
    return date
  } catch {
    return null
  }
}
