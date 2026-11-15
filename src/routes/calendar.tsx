import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Calendar } from '../components/Calendar'
import { getCachedEvents } from '../lib/cache/events-cache'
import type {Event} from '../lib/scrapers';

interface CalendarData {
  events: Array<Event>
}

// Server function to get events for calendar
const getCalendarEvents = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<CalendarData> => {
  const { getCloudflareEnv, getWaitUntil } = await import('../lib/server/session')
  const env = getCloudflareEnv(ctx)
  const result = await getCachedEvents(env, getWaitUntil(ctx))

  // Add approved host submissions; drop removed and already-finished events
  const { withApprovedAndWithoutRemoved } = await import(
    '../lib/server/visible-events'
  )

  return {
    events: await withApprovedAndWithoutRemoved(result.events),
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
