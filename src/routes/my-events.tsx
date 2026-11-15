import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import { EventForm } from '../components/EventForm'
import { Edit, Trash2, Calendar, Clock, MapPin } from 'lucide-react'
import { getMyEvents, deleteUserEvent } from '../lib/server/user-events'
import { toast } from 'sonner'

interface UserEvent {
  id: string
  userId: string
  title: string
  date: string
  time: string
  link: string
  description: string | null
  category: string | null
  image: string | null
  venue: string | null
  price: string | null
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

// Server function to check if user has required role
const checkUserRole = createServerFn({
  method: 'GET',
}).handler(async (ctx: any) => {
  try {
    const request = ctx.request
    if (!request || !request.headers) {
      return null
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(
      /better-auth\.session_token=([^;]+)/,
    )

    if (!sessionMatch) {
      return null
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../db')
    const { session: sessionTable, user: userTable } = await import(
      '../db/schema'
    )
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      return null
    }

    const userId = sessionData[0].userId

    // Get user to check role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      return null
    }

    const user = userData[0]

    // Check if user has admin or host role
    if (user.role === 'admin' || user.role === 'host') {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }

    return null
  } catch (error) {
    console.error('Failed to check user role:', error)
    return null
  }
})

export const Route = createFileRoute('/my-events')({
  beforeLoad: async () => {
    // Check user role on server
    const user = await checkUserRole()
    if (!user) {
      throw redirect({
        to: '/',
      })
    }
    return { user }
  },
  loader: async () => {
    const events = await getMyEvents()
    return { events }
  },
  component: MyEventsPage,
})

function MyEventsPage() {
  const { events: initialEvents } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const router = useRouter()
  const [events, setEvents] = useState<UserEvent[]>(initialEvents)
  const [editingEvent, setEditingEvent] = useState<UserEvent | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const isAdmin = user?.role === 'admin'

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'rejected':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const handleEdit = (event: UserEvent) => {
    setEditingEvent(event)
    setIsEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false)
    setEditingEvent(null)
    // Refresh events from server
    router.invalidate()
  }

  const handleDelete = (eventId: string) => {
    setDeletingEventId(eventId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingEventId) return

    setIsDeleting(true)
    try {
      // @ts-ignore - Server function typing
      await deleteUserEvent({ data: { eventId: deletingEventId } })
      setEvents(events.filter((e) => e.id !== deletingEventId))
      toast.success('Event deleted successfully!')
      setIsDeleteDialogOpen(false)
      setDeletingEventId(null)
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Failed to delete event. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDelete = () => {
    setIsDeleteDialogOpen(false)
    setDeletingEventId(null)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl">My Events</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => navigate({ to: '/add-event' })}>
                Create New Event
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: '/' })}>
                Back to Events
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Total events: {events.length}
          </p>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No events created yet. Create your first event!
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium max-w-xs flex items-center gap-2">
                        <img
                          src={event.image || ''}
                          alt="Event Image"
                          className="w-10 h-10 rounded-md"
                        />
                        <div className="truncate">{event.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {event.time}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.venue ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-xs">
                              {event.venue}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {event.category ? (
                          <Badge variant="outline">{event.category}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(event.status)}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(event)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <EventForm
              mode="edit"
              initialValues={{
                id: editingEvent.id,
                title: editingEvent.title,
                date: editingEvent.date,
                time: editingEvent.time,
                link: editingEvent.link,
                description: editingEvent.description || '',
                category: editingEvent.category || '',
                venue: editingEvent.venue || '',
                price: editingEvent.price || '',
                image: editingEvent.image || '',
                featured: editingEvent.featured || false,
              }}
              onSuccess={handleEditSuccess}
              onCancel={() => {
                setIsEditDialogOpen(false)
                setEditingEvent(null)
              }}
              submitButtonText="Update Event"
              showCancelButton={true}
              isAdmin={isAdmin}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
