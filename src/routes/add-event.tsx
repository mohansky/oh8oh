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

    const { db } = await import('../db')
    const { session: sessionTable, user: userTable } = await import('../db/schema')
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
