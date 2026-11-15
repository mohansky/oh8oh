import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { getCachedEvents } from '../lib/cache/events-cache'
import { EventCard } from '../components/EventCard'
import { EventCardSkeleton } from '../components/EventCardSkeleton'
import { EventFilters } from '../components/EventFilters'
import { authClient } from '../lib/auth-client'
// import { markEventAsRemoved, getRemovedEventFingerprints } from '../lib/server/user-events'
// import { generateEventFingerprint } from '../lib/utils/event-fingerprint'
import { markEventAsRemoved } from '../lib/server/user-events'
import { refreshAllEvents, refreshEvents } from '../lib/server/events-refresh'
import {
  compareEventDateTimes,
  isToday,
  isTomorrow,
  isUpcomingEvent,
  isWeekend,
} from '../lib/utils/date-time'
import { getAllCategories, normalizeCategories } from '../lib/utils/categorize-event'
import type {Event} from '../lib/scrapers';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface ScrapedData {
  events: Array<Event>
  totalScrapers: number
  successCount: number
  errorCount: number
  cached?: boolean
  cacheAge?: number
}

// Server function to get events (cached or fresh)
const scrapeEvents = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<ScrapedData> => {
  const { getCloudflareEnv, getWaitUntil } = await import('../lib/server/session')
  const env = getCloudflareEnv(ctx)
  const result = await getCachedEvents(env, getWaitUntil(ctx))

  // Add approved host submissions; drop removed and already-finished events.
  // The client only ever shows upcoming events, so don't ship the rest.
  const { withApprovedAndWithoutRemoved } = await import(
    '../lib/server/visible-events'
  )

  return {
    ...result,
    events: await withApprovedAndWithoutRemoved(result.events),
  }
})

function LoadingComponent() {
  return (
    <div>
      {/* Filters skeleton placeholder */}
      <div className="py-8 px-6 max-w-7xl mx-auto">
        <div className="h-20 mb-6" /> {/* Spacer for filters */}
      </div>

      {/* Events Grid Skeleton */}
      <section className="py-8 px-2 lg:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-1 md:gap-3 lg:gap-6 items-stretch">
          {Array.from({ length: 12 }).map((_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: EventsPage,
  loader: async () => await scrapeEvents(),
  pendingComponent: LoadingComponent,
  // Client-side cache for 5 minutes (data is already cached server-side)
  staleTime: 5 * 60 * 1000,
  // Background refresh when tab regains focus
  gcTime: 10 * 60 * 1000,
})

function EventsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [filter, setFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'weekend'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const ITEMS_PER_PAGE = 12

  // Check if current user is admin
  const isAdmin = session?.user?.role === 'admin'

  // Handle manual refresh. The quick refresh re-reads only the fast sources
  // (the same ones the automatic 30-minute refresh covers); the full refresh
  // runs every scraper, including the browser-rendered ones, exactly like the
  // nightly cron.
  const handleRefresh = async (full: boolean = false) => {
    if (!isAdmin) {
      toast.error('Only admins can refresh events')
      return
    }

    setIsRefreshing(true)
    toast.info(
      full
        ? 'Running every scraper… this can take a few minutes. Keep this tab open.'
        : 'Refreshing events... This may take 30-60 seconds',
    )

    try {
      // @ts-ignore - Server function typing
      const result = await (full ? refreshAllEvents() : refreshEvents())

      if (result.success) {
        // Invalidate the route to refetch data
        await router.invalidate()
        toast.success('Events refreshed successfully!')
      } else {
        toast.error(`Refresh failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Refresh failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Refresh failed: ${errorMessage}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle admin remove event
  const handleRemoveEvent = async (event: Event) => {
    try {
      // @ts-ignore - Server function typing
      await markEventAsRemoved({ data: { event } })
      toast.success('Event removed from list')
      // Refresh the page to show updated events
      await router.invalidate()
    } catch (error) {
      console.error('Failed to remove event:', error)
      toast.error('Failed to remove event. Please try again.')
    }
  }

  // Venue alias mapping for common abbreviations
  const venueAliases: { [key: string]: Array<string> } = {
    'bangalore international centre': ['bic'],
    'museum of art & photography': ['map'],
    'indian heritage academy': ['iha'],
    'sabha': ['sabha'],
  }

  // Helper function to check if search matches venue (including aliases)
  const matchesVenueOrAlias = (venue: string | undefined, searchTerm: string): boolean => {
    if (!venue) return false

    const venueLower = venue.toLowerCase()
    const searchLower = searchTerm.toLowerCase()

    // Direct venue match
    if (venueLower.includes(searchLower)) return true

    // Check if search term matches any aliases
    for (const [fullName, aliases] of Object.entries(venueAliases)) {
      if (venueLower.includes(fullName)) {
        // If the venue matches a full name, check if search term is an alias
        if (aliases.some(alias => alias === searchLower)) {
          return true
        }
      }
      // If search term is the full name, check if venue matches any alias
      if (searchLower === fullName) {
        return aliases.some(alias => venueLower.includes(alias))
      }
    }

    return false
  }

  // Filter out past events and sort by date and time using utility functions
  const upcomingEvents = data.events
    .filter((event) => isUpcomingEvent(event.date))
    .sort((a, b) => compareEventDateTimes(a, b))

  // Get unique sources and categories
  // An event merged from two sites has a source like "BIC, Urbanaut", so
  // split before listing and match on any one of them.
  const eventSources = (source: string) => source.split(',').map((s) => s.trim())
  const sources = [
    'all',
    ...[...new Set(upcomingEvents.flatMap((e) => eventSources(e.source)))].sort(
      (a, b) => a.localeCompare(b),
    ),
  ]
  const categories = ['all', ...getAllCategories().filter(cat => cat !== 'Other'), 'Other']

  // Filter events by search, source, date, and category
  const filteredEvents = upcomingEvents.filter((event) => {
    const searchLower = filter.toLowerCase()
    const matchesSearch =
      event.title.toLowerCase().includes(searchLower) ||
      matchesVenueOrAlias(event.venue, filter)
    const matchesSource =
      sourceFilter === 'all' || eventSources(event.source).includes(sourceFilter)

    // Apply date filter
    let matchesDate = true
    if (dateFilter === 'today') {
      matchesDate = isToday(event.date)
    } else if (dateFilter === 'tomorrow') {
      matchesDate = isTomorrow(event.date)
    } else if (dateFilter === 'weekend') {
      matchesDate = isWeekend(event.date)
    }

    // Apply category filter (check if any of the event's categories match)
    const matchesCategory =
      categoryFilter === 'all' ||
      normalizeCategories(event.category).includes(categoryFilter)

    return matchesSearch && matchesSource && matchesDate && matchesCategory
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, sourceFilter, dateFilter, categoryFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex)

  return (
    <div>
      {/* <section className="relative py-12 px-6 text-center overflow-hidden border-b border-slate-700">
        <H1>Bangalore Events</H1>
      </section> */}

      {/* Filters */}
      <EventFilters
        filter={filter}
        setFilter={setFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sources={sources}
        categories={categories}
        filteredCount={filteredEvents.length}
        totalCount={upcomingEvents.length}
        cacheAge={data.cacheAge}
        onRefresh={() => handleRefresh(false)}
        onFullRefresh={() => handleRefresh(true)}
        isRefreshing={isRefreshing}
        isAdmin={isAdmin}
      />

      {/* Events Grid */}
      <section className="py-8 px-2 lg:px-6 max-w-7xl mx-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">
              {upcomingEvents.length === 0
                ? 'No upcoming events found. Please check back later.'
                : 'No events match your search.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-2 md:gap-3 lg:gap-6 items-stretch">
              {paginatedEvents.map((event, index) => (
                <EventCard
                  key={index}
                  event={event}
                  isAdmin={isAdmin}
                  onRemove={handleRemoveEvent}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)

                    if (!showPage) {
                      // Show ellipsis
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      return null
                    }

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </section>
    </div>
  )
}
