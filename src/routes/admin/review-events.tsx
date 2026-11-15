import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog'
import { Calendar, Clock, MapPin, Link as LinkIcon, DollarSign, CheckCircle, XCircle, Trash2, Eye, Edit } from 'lucide-react'
import {
  getPendingEvents,
  approveEvent,
  rejectEvent,
  adminDeleteEvent,
} from '../../lib/server/user-events'
import { EventForm } from '../../components/EventForm'
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

// Server function to check if user has admin role
const checkAdminRole = createServerFn({
  method: 'GET',
}).handler(async (ctx: any) => {
  try {
    const request = ctx.request
    if (!request || !request.headers) {
      return null
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      return null
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable } = await import('../../db/schema')
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

    // Check if user has admin role
    if (user.role === 'admin') {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }

    return null
  } catch (error) {
    console.error('Failed to check admin role:', error)
    return null
  }
})

export const Route = createFileRoute('/admin/review-events')({
  beforeLoad: async () => {
    // Check user has admin role
    const user = await checkAdminRole()
    if (!user) {
      throw redirect({
        to: '/',
      })
    }
    return { user }
  },
  loader: async () => {
    const events = await getPendingEvents()
    return { events }
  },
  component: ReviewEventsPage,
})

function ReviewEventsPage() {
  const { events: initialEvents } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const [events, setEvents] = useState<UserEvent[]>(initialEvents)
  const [previewEvent, setPreviewEvent] = useState<UserEvent | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Edit dialog states
  const [editingEvent, setEditingEvent] = useState<UserEvent | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Dialog states for confirm actions
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [actionEventId, setActionEventId] = useState<string | null>(null)

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

  const handlePreview = (event: UserEvent) => {
    setPreviewEvent(event)
    setIsPreviewOpen(true)
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

  const handleApprove = (eventId: string) => {
    setActionEventId(eventId)
    setIsApproveDialogOpen(true)
  }

  const confirmApprove = async () => {
    if (!actionEventId) return

    setIsProcessing(true)
    try {
      // @ts-ignore - Server function typing
      await approveEvent({ data: { eventId: actionEventId } })
      setEvents(events.filter((e) => e.id !== actionEventId))
      toast.success('Event approved successfully!')
      setIsPreviewOpen(false)
      setIsApproveDialogOpen(false)
      setActionEventId(null)
    } catch (error) {
      console.error('Failed to approve event:', error)
      toast.error('Failed to approve event. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = (eventId: string) => {
    setActionEventId(eventId)
    setIsRejectDialogOpen(true)
  }

  const confirmReject = async () => {
    if (!actionEventId) return

    setIsProcessing(true)
    try {
      // @ts-ignore - Server function typing
      await rejectEvent({ data: { eventId: actionEventId } })
      setEvents(
        events.map((e) =>
          e.id === actionEventId ? { ...e, status: 'rejected' as const } : e
        )
      )
      toast.success('Event rejected!')
      setIsPreviewOpen(false)
      setIsRejectDialogOpen(false)
      setActionEventId(null)
    } catch (error) {
      console.error('Failed to reject event:', error)
      toast.error('Failed to reject event. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = (eventId: string) => {
    setActionEventId(eventId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!actionEventId) return

    setIsProcessing(true)
    try {
      // @ts-ignore - Server function typing
      await adminDeleteEvent({ data: { eventId: actionEventId } })
      setEvents(events.filter((e) => e.id !== actionEventId))
      toast.success('Event deleted successfully!')
      setIsPreviewOpen(false)
      setIsDeleteDialogOpen(false)
      setActionEventId(null)
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Failed to delete event. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const pendingCount = events.filter((e) => e.status === 'pending').length
  const rejectedCount = events.filter((e) => e.status === 'rejected').length

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl">Review Event Submissions</CardTitle>
            <Button variant="outline" onClick={() => navigate({ to: '/' })}>
              Back to Events
            </Button>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              Pending: <strong>{pendingCount}</strong>
            </span>
            <span>
              Rejected: <strong>{rejectedCount}</strong>
            </span>
            <span>
              Total: <strong>{events.length}</strong>
            </span>
          </div>
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
                      No events pending review.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium max-w-xs">
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
                            <span className="truncate max-w-xs">{event.venue}</span>
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
                            onClick={() => handlePreview(event)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(event)}
                            disabled={isProcessing}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {event.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(event.id)}
                                disabled={isProcessing}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleReject(event.id)}
                                disabled={isProcessing}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(event.id)}
                            disabled={isProcessing}
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Preview</DialogTitle>
          </DialogHeader>
          {previewEvent && (
            <div className="space-y-6">
              {/* Event Image */}
              {previewEvent.image && (
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img
                    src={previewEvent.image}
                    alt={previewEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Event Details */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{previewEvent.title}</h2>
                  <Badge variant={getStatusBadgeVariant(previewEvent.status)} className="mt-2">
                    {previewEvent.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">
                        {new Date(previewEvent.date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium">{previewEvent.time}</p>
                    </div>
                  </div>

                  {previewEvent.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Venue</p>
                        <p className="font-medium">{previewEvent.venue}</p>
                      </div>
                    </div>
                  )}

                  {previewEvent.price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium">{previewEvent.price}</p>
                      </div>
                    </div>
                  )}

                  {previewEvent.category && (
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <Badge variant="outline">{previewEvent.category}</Badge>
                      </div>
                    </div>
                  )}

                  {previewEvent.link && (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Event Link</p>
                        <a
                          href={previewEvent.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          View Event
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {previewEvent.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{previewEvent.description}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsPreviewOpen(false)
                    handleEdit(previewEvent)
                  }}
                  disabled={isProcessing}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Event
                </Button>
                {previewEvent.status === 'pending' && (
                  <>
                    <Button
                      className="flex-1"
                      onClick={() => handleApprove(previewEvent.id)}
                      disabled={isProcessing}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => handleReject(previewEvent.id)}
                      disabled={isProcessing}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(previewEvent.id)}
                  disabled={isProcessing}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this event? It will be visible to all users on the main events page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsApproveDialogOpen(false)
                setActionEventId(null)
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={confirmApprove} disabled={isProcessing}>
              {isProcessing ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this event? The event will remain in the review list but marked as rejected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false)
                setActionEventId(null)
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={confirmReject}
              disabled={isProcessing}
            >
              {isProcessing ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setActionEventId(null)
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              isAdmin={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
