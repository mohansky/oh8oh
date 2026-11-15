import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { getDayName, getMonthCalendar, getMonthName, parseEventDateToDate } from '../lib/utils/calendar'
import { generateEventFingerprint } from '../lib/utils/event-fingerprint'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import type { Event } from '../lib/scrapers/types'

interface CalendarProps {
  events: Array<Event>
}

export function Calendar({ events }: CalendarProps) {
  const router = useRouter()
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const weeks = getMonthCalendar(currentYear, currentMonth)

  // Group events by date
  const eventsByDate = new Map<string, Array<Event>>()
  events.forEach((event) => {
    const eventDate = parseEventDateToDate(event.date)
    if (eventDate) {
      const key = eventDate.toISOString().split('T')[0]
      if (!eventsByDate.has(key)) {
        eventsByDate.set(key, [])
      }
      eventsByDate.get(key)!.push(event)
    }
  })

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
  }

  const handleEventClick = (event: Event) => {
    const fingerprint = generateEventFingerprint(event)
    router.navigate({ to: '/event/$fingerprint', params: { fingerprint } })
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {getMonthName(currentMonth)} {currentYear}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        {/* Day Names Header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-gray-400 py-2"
            >
              {getDayName(day)}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="space-y-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIndex) => {
                const dateKey = day.date.toISOString().split('T')[0]
                const dayEvents = eventsByDate.get(dateKey) || []

                return (
                  <div
                    key={dayIndex}
                    className={`
                      min-h-24 p-2 rounded-lg border
                      ${day.isCurrentMonth ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-900/20 border-slate-800'}
                      ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                    `}
                  >
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${day.isCurrentMonth ? 'text-white' : 'text-gray-600'}
                        ${day.isToday ? 'text-blue-400' : ''}
                      `}
                    >
                      {day.dayNumber}
                    </div>

                    {/* Events for this day */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, eventIndex) => (
                        <button
                          key={eventIndex}
                          onClick={() => handleEventClick(event)}
                          className="w-full text-left"
                        >
                          <Badge
                            variant="secondary"
                            className="text-xs truncate w-full justify-start hover:bg-blue-600 transition-colors cursor-pointer"
                            title={event.title}
                          >
                            {event.title}
                          </Badge>
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-400 pl-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
