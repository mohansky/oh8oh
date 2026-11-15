import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { EventCard } from '../components/EventCard'
import { EventCardSkeleton } from '../components/EventCardSkeleton'
import { getUserBookmarks } from '../lib/db/bookmarks-db'
import type { Event } from '../lib/scrapers/types'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

// Server function to get user's bookmarks
const getBookmarks = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<Event[]> => {
  try {
    // Access request from handler context
    const request = ctx.request

    if (!request || !request.headers) {
      console.error('No request object in context')
      return []
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      return []
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../db')
    const { session: sessionTable } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      return []
    }

    const userId = sessionData[0].userId
    return await getUserBookmarks(userId)
  } catch (error) {
    console.error('Failed to get bookmarks:', error)
    return []
  }
})

function LoadingComponent() {
  return (
    <div className="py-8 px-6 max-w-7xl mx-auto">
      <div className="h-20 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {Array.from({ length: 6 }).map((_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/bookmarks')({
  component: BookmarksPage,
  loader: async () => await getBookmarks(),
  pendingComponent: LoadingComponent,
})

function BookmarksPage() {
  const bookmarkedEvents = Route.useLoaderData()
  const [searchQuery, setSearchQuery] = useState('')

  // Filter bookmarked events by search query (title and venue)
  const filteredEvents = bookmarkedEvents.filter((event) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesTitle = event.title.toLowerCase().includes(searchLower)
    const matchesVenue = event.venue?.toLowerCase().includes(searchLower) || false
    return matchesTitle || matchesVenue
  })

  return (
    <div>
      {/* Header */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Bookmarked Events</h1>
          <p className="text-muted-foreground">
            Events you've saved for later ({bookmarkedEvents.length})
          </p>
        </div>
      </section>

      {/* Search Bar */}
      {bookmarkedEvents.length > 0 && (
        <section className="py-6 px-6 max-w-7xl mx-auto">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by title or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredEvents.length} of {bookmarkedEvents.length} events
            </p>
          )}
        </section>
      )}

      {/* Bookmarked Events Grid */}
      <section className="py-8 px-6 max-w-7xl mx-auto">
        {bookmarkedEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-4">
              You haven't bookmarked any events yet.
            </p>
            <p className="text-gray-500 text-sm">
              Click the heart icon on any event to save it here.
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">
              No bookmarked events match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {filteredEvents.map((event, index) => (
              <EventCard key={index} event={event} isBookmarked={true} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
