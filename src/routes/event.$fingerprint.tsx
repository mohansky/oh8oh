import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft, Calendar, CalendarPlus, Clock, ExternalLink, MapPin, Share2, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { getEventByFingerprint } from '../lib/server/get-event'
import { formatTime, processEventDateTime } from '../lib/utils/date-time'
import { normalizeCategories } from '../lib/utils/categorize-event'
import { downloadICS } from '../lib/utils/ics'
import { safeExternalUrl } from '../lib/utils/validation'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/event/$fingerprint')({
  component: EventPage,
  loader: async ({ params }) => {
    // @ts-ignore - Server function typing
    const event = await getEventByFingerprint({ data: params.fingerprint })
    if (!event) {
      // Past events are pruned, so old shared links land here — show a
      // friendly 404 rather than the generic error screen.
      throw notFound()
    }
    return event
  },
  notFoundComponent: EventNotFound,
  head: ({ loaderData }) => {
    if (!loaderData) return {}

    const event = loaderData
    const { cleanDate } = processEventDateTime({
      date: event.date,
      time: event.time,
    })

    return {
      meta: [
        {
          title: `${event.title} | oh eight oh`,
        },
        {
          name: 'description',
          content: event.description || `${event.title} - ${cleanDate} at ${event.venue || 'Bangalore'}`,
        },
        // Open Graph tags
        {
          property: 'og:title',
          content: event.title,
        },
        {
          property: 'og:description',
          content: event.description || `${event.title} - ${cleanDate} at ${event.venue || 'Bangalore'}`,
        },
        {
          property: 'og:type',
          content: 'website',
        },
        ...(event.image
          ? [
              {
                property: 'og:image',
                content: event.image,
              },
            ]
          : []),
        // Twitter Card tags
        {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          name: 'twitter:title',
          content: event.title,
        },
        {
          name: 'twitter:description',
          content: event.description || `${event.title} - ${cleanDate} at ${event.venue || 'Bangalore'}`,
        },
        ...(event.image
          ? [
              {
                name: 'twitter:image',
                content: event.image,
              },
            ]
          : []),
      ],
    }
  },
})

function EventNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-stackSansNotch">Event not found</h1>
        <p className="text-muted-foreground">
          This event may be over, or it is no longer listed by its organiser.
        </p>
        <Button asChild>
          <Link to="/">See upcoming events</Link>
        </Button>
      </div>
    </div>
  )
}

function EventPage() {
  const event = Route.useLoaderData()
  const { data: session } = authClient.useSession()
  const userTimeFormat = (session?.user)?.timeFormat || '12h'

  const { cleanDate, cleanTime } = processEventDateTime({
    date: event.date,
    time: event.time,
  })

  const formattedTime = formatTime(cleanTime, userTimeFormat)
  const categories = event.category ? normalizeCategories(event.category) : []

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url: url,
        })
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(url)
        }
      }
    } else {
      copyToClipboard(url)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success('Link copied to clipboard!')
      },
      () => {
        toast.error('Failed to copy link')
      }
    )
  }

  const handleAddToCalendar = () => {
    try {
      downloadICS(event)
      toast.success('Calendar file downloaded!')
    } catch (error) {
      console.error('Failed to download calendar file:', error)
      toast.error('Failed to generate calendar file')
    }
  }

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        <Card className="overflow-hidden">
          {/* Event Image */}
          {event.image && (
            <div className="relative w-full aspect-video overflow-hidden">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover"
              />

              {/* Category badges on image */}
              {categories.length > 0 && (
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                  {categories.map((cat, index) => (
                    <Badge key={index} variant="secondary" className="bg-background/80 backdrop-blur-sm">
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-3xl font-stackSansNotch">{event.title}</CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="shrink-0"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Event Details */}
            <div className="grid gap-4">
              {/* Date and Time */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg">{cleanDate}</span>
                </div>
                {formattedTime && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <span className="text-lg">{formattedTime}</span>
                  </div>
                )}
              </div>

              {/* Venue */}
              {event.venue && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg">{event.venue}</span>
                </div>
              )}

              {/* Price */}
              {event.price && (
                <div className="flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg font-medium">{event.price}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-xl font-semibold mb-3">About this event</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1">
                <a href={safeExternalUrl(event.link)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on {event.source}
                </a>
              </Button>
              <Button variant="outline" onClick={handleAddToCalendar} className="flex-1">
                <CalendarPlus className="w-4 h-4 mr-2" />
                Add to Calendar
              </Button>
            </div>

            {/* Source */}
            <div className="text-sm text-gray-400 pt-2">
              Source: <span className="text-gray-300">{event.source}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
