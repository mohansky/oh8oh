import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { authClient } from '../lib/auth-client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { EventForm } from '../components/EventForm'

// Server function to check if user has required role
const checkUserRole = createServerFn({
  method: 'GET',
}).handler(async (ctx: any) => {
  try {
    const { getSessionUser, headersFromCtx } = await import('../lib/server/session')
    const user = await getSessionUser(headersFromCtx(ctx))

    // Check if user has admin or host role
    if (user && (user.role === 'admin' || user.role === 'host')) {
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

export const Route = createFileRoute('/add-event')({
  beforeLoad: async () => {
    // Check user role on server
    const user = await checkUserRole()
    if (!user) {
      throw redirect({
        to: '/auth',
      })
    }
    return { user }
  },
  component: AddEventPage,
})

function AddEventPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Add New Event</CardTitle>
          {session?.user && (
            <p className="text-sm text-muted-foreground">
              Posting as {session.user.name} ({session.user.role})
            </p>
          )}
        </CardHeader>
        <CardContent>
          <EventForm
            onSuccess={() => navigate({ to: '/' })}
            onCancel={() => navigate({ to: '/' })}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  )
}
