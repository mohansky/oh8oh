import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Calendar } from '../components/Calendar'
import { type Event } from '../lib/scrapers'
import { getCachedEvents } from '../lib/cache/events-cache'
import { isUpcomingEvent } from '../lib/utils/date-time'

interface CalendarData {
  events: Event[]
}

// Server function to get events for calendar
const getCalendarEvents = createServerFn({
  method: 'GET',
}).handler(async (): Promise<CalendarData> => {
  const result = await getCachedEvents()

  // Also fetch approved user-submitted events
  const { db } = await import('../db')
  const { userEvents: userEventsTable, removedEvents } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')
  const { generateEventFingerprint } = await import('../lib/utils/event-fingerprint')

  const userEventsData = await db
    .select()
    .from(userEventsTable)
    .where(eq(userEventsTable.status, 'approved'))

  // Convert to Event format
  const userEvents = userEventsData.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    link: event.link,
    description: event.description || '',
    category: event.category || '',
    image: event.image || '',
    venue: event.venue || '',
    price: event.price || '',
    source: 'user-submitted',
  }))

  // Merge events
  const allEvents = [...result.events, ...userEvents]

  // Get removed event fingerprints
  const removedEventsData = await db.select().from(removedEvents)
  const removedFingerprints = new Set(removedEventsData.map((r) => r.eventFingerprint))

  // Filter out removed events and only show upcoming events
  const filteredEvents = allEvents.filter((event) => {
    const fingerprint = generateEventFingerprint(event)
    return !removedFingerprints.has(fingerprint) && isUpcomingEvent(event.date)
  })

  return {
    events: filteredEvents,
  }
})

export const Route = createFileRoute('/calendar')({
  component: CalendarPage,
  loader: async () => await getCalendarEvents(),
  pendingComponent: () => (
    <div className="py-12 px-6 max-w-7xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-700 rounded w-64"></div>
        <div className="h-96 bg-slate-700 rounded"></div>
      </div>
    </div>
  ),
})

function CalendarPage() {
  const data = Route.useLoaderData()

  return (
    <div className="py-12 px-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Event Calendar</h1>
        <p className="text-gray-400">
          Showing {data.events.length} upcoming events
        </p>
      </div>

      <Calendar events={data.events} />
    </div>
  )
}
