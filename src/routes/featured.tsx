import { createFileRoute } from '@tanstack/react-router'
import { getFeaturedEvents } from '../lib/server/user-events'
import { EventCard } from '../components/EventCard'
import { EventCardSkeleton } from '../components/EventCardSkeleton'
import type { Event } from '../lib/scrapers/types'
import { normalizeCategories } from '../lib/utils/categorize-event'
import { isUpcomingEvent, compareEventDateTimes } from '../lib/utils/date-time'
import { Star } from 'lucide-react'

function LoadingComponent() {
  return (
    <div>
      {/* Header */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 mb-2" />
          <div className="h-6" />
        </div>
      </section>

      {/* Events Grid Skeleton */}
      <section className="py-8 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {Array.from({ length: 6 }).map((_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/featured')({
  component: FeaturedEventsPage,
  loader: async () => await getFeaturedEvents(),
  pendingComponent: LoadingComponent,
})

function FeaturedEventsPage() {
  const featuredEvents = Route.useLoaderData()

  // Filter out past events and sort by date
  const upcomingFeaturedEvents = featuredEvents
    .filter((event: Event) => isUpcomingEvent(event.date))
    .sort((a: Event, b: Event) => compareEventDateTimes(a, b))

  // Group events by category
  const eventsByCategory: Record<string, Event[]> = {}

  upcomingFeaturedEvents.forEach((event: Event) => {
    const categories = normalizeCategories(event.category)

    // Add event to each of its categories
    categories.forEach((category) => {
      if (!eventsByCategory[category]) {
        eventsByCategory[category] = []
      }
      eventsByCategory[category].push(event)
    })
  })

  // Sort categories alphabetically, but put "Other" at the end
  const sortedCategories = Object.keys(eventsByCategory).sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b)
  })

  return (
    <div>
      {/* Header */}
      <section className="py-12 px-6 border-bbg-linear-to-r from-primary/10 to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-8 h-8 text-primary fill-primary" />
            <h1 className="text-4xl font-bold">Featured Events</h1>
          </div>
          <p className="text-muted-foreground">
            Handpicked events curated by our team ({upcomingFeaturedEvents.length} featured events)
          </p>
        </div>
      </section>

      {/* Featured Events Grouped by Category */}
      <section className="py-8 px-6 max-w-7xl mx-auto">
        {upcomingFeaturedEvents.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              No featured events at the moment.
            </p>
            <p className="text-gray-500 text-sm">
              Check back soon for handpicked events!
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {sortedCategories.map((category) => (
              <div key={category}>
                {/* Category Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">{category}</h2>
                  <div className="h-1 w-20 bg-primary rounded-full" />
                </div>

                {/* Events Grid for this category */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {eventsByCategory[category].map((event, index) => (
                    <EventCard key={`${category}-${index}`} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
