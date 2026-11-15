import { Calendar, MapPin, Clock, Ticket, Heart, X, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Event } from '../lib/scrapers'
import { processEventDateTime, formatTime } from '../lib/utils/date-time'
import { normalizeCategories } from '../lib/utils/categorize-event'
import { generateEventFingerprint } from '../lib/utils/event-fingerprint'
import { authClient } from '../lib/auth-client'
import {
  Card,
  CardContent,
  CardDescription,
  // CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from './ui/badge'
import { AspectRatio } from './ui/aspect-ratio'
import { Button } from './ui/button'
import { Image } from './Image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { toggleBookmark } from '../lib/server/bookmarks'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

interface EventCardProps {
  event: Event
  isBookmarked?: boolean
  onBookmarkChange?: () => void
  isAdmin?: boolean
  onRemove?: (event: Event) => void
}

export function EventCard({
  event,
  isBookmarked = false,
  onBookmarkChange,
  isAdmin = false,
  onRemove,
}: EventCardProps) {
  const router = useRouter()
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const [isToggling, setIsToggling] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  // Get user's time format preference
  const { data: session } = authClient.useSession()
  const userTimeFormat = (session?.user as any)?.timeFormat || '12h'

  // Process date and time using universal utility
  const { cleanDate, cleanTime } = processEventDateTime({
    date: event.date,
    time: event.time,
  })

  // Format time according to user preference
  const formattedTime = formatTime(cleanTime, userTimeFormat)

  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsToggling(true)
    try {
      // @ts-ignore - Server function typing doesn't match runtime behavior
      const result = await toggleBookmark({ data: event })
      setBookmarked(result.bookmarked)
      onBookmarkChange?.()
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      // If not authenticated, could redirect to login
      if (
        error instanceof Error &&
        error.message.includes('not authenticated')
      ) {
        router.navigate({ to: '/auth' })
      }
    } finally {
      setIsToggling(false)
    }
  }

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsRemoveDialogOpen(true)
  }

  const confirmRemove = async () => {
    setIsRemoving(true)
    try {
      if (onRemove) {
        await onRemove(event)
        toast.success('Event sent to review list for moderation')
      }
      setIsRemoveDialogOpen(false)
    } catch (error) {
      console.error('Failed to remove event:', error)
      toast.error('Failed to send event to review. Please try again.')
    } finally {
      setIsRemoving(false)
    }
  }

  const cancelRemove = () => {
    setIsRemoveDialogOpen(false)
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const fingerprint = generateEventFingerprint(event)
    router.navigate({ to: '/event/$fingerprint', params: { fingerprint } })
  }

  return (
    <>
      <a
        href={event.link}
        target="_blank"
        rel="noopener noreferrer"
        className="h-full block"
      >
        <Card className="group p-0 mb:pb-0 overflow-hidden relative h-full grid grid-cols-3 md:flex md:flex-col">
          <span className="absolute bottom-1 right-1 z-10  flex gap-1 lg:gap-3">
            {/* Admin Remove Button */}
            {isAdmin && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 backdrop-blur-sm hover:bg-destructive/90 hover:text-destructive-foreground"
                onClick={handleRemoveClick}
                disabled={isRemoving}
              >
                <X className="w-5 h-5 text-muted-foreground hover:text-destructive-foreground" />
              </Button>
            )}

            {/* Share Button */}
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={handleShareClick}
            >
              <Share2 className="w-5 h-5 text-muted-foreground hover:text-primary" />
            </Button>

            {/* Bookmark Button */}
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={handleBookmarkClick}
              disabled={isToggling}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  bookmarked
                    ? 'fill-destructive text-destructive'
                    : 'text-muted-foreground hover:text-destructive'
                }`}
              />
            </Button>
          </span>

          {/* Image */}
          {event.image && (
            <div className="col-span-1 md:col-span-3 relative h-full md:h-auto">
              <div className="relative h-full md:hidden overflow-hidden">
                <Image
                  src={event.image}
                  alt={event.title}
                  fill
                  objectFit="cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                  className="group-hover:scale-110 h-full object-cover  transition-transform duration-300"
                />
              </div>
              <AspectRatio
                ratio={4 / 3}
                className="overflow-hidden hidden md:block"
              >
                <Image
                  src={event.image}
                  alt={event.title}
                  fill
                  objectFit="cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                  className="group-hover:scale-110 transition-transform duration-300"
                />
              </AspectRatio>

              {/* Category badges at bottom of image */}
              {event.category && (
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                  {(() => {
                    const categories = normalizeCategories(event.category)
                    // Debug: log if multiple categories
                    if (categories.length > 1) {
                      console.log(
                        `Event "${event.title}" has ${categories.length} categories:`,
                        categories,
                      )
                    }
                    return categories.map((cat, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs bg-background/80 backdrop-blur-sm"
                      >
                        {cat}
                      </Badge>
                    ))
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="col-span-2 md:col-span-3 flex flex-col py-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg md:text-2xl font-stackSansNotch line-clamp-2">
                {event.title}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1">
                {/* Date */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <p className="text-xs">{cleanDate}</p>
                </div>
                {formattedTime && (
                  <>
                    <span>|</span>
                    {/* Time */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <p className="text-xs">{formattedTime}</p>
                    </div>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <div className="space-y-1">
                {/* Event Details */}
                {/* Venue */}
                {event.venue && (
                  <div className="flex items-center gap-2 ">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <p className="text-xs lg:text-sm line-clamp-1">
                      {event.venue}
                    </p>
                  </div>
                )}

                {/* Price */}
                {event.price && (
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 shrink-0" />
                    <p className="text-xs lg:text-sm">{event.price}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </div>
          {/* <CardFooter>
          <a href={event.link} target="_blank" rel="noopener noreferrer">
            <Button>View Details</Button>
          </a>
        </CardFooter> */}
        </Card>
      </a>
      {/* Remove Confirmation Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Review</DialogTitle>
            <DialogDescription>
              This event will be removed from the main list and sent to the
              review list. You can then update, approve, or permanently delete
              it from there.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelRemove}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={confirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Sending...' : 'Send to Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
