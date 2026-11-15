import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
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
import { Shield, UserCog, User as UserIcon } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'host' | 'user'
  emailVerified: boolean
  createdAt: Date
}

// Server function to check if user is admin
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

// Server function to get all users
const getAllUsers = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<User[]> => {
  try {
    const request = ctx.request
    if (!request || !request.headers) {
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

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable } = await import('../../db/schema')
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

    // Verify user is admin
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0 || userData[0].role !== 'admin') {
      return []
    }

    // Get all users
    const allUsers = await db.select().from(userTable)

    return allUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'admin' | 'host' | 'user',
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    }))
  } catch (error) {
    console.error('Failed to get users:', error)
    return []
  }
})

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    // Check if user is admin
    const user = await checkAdminRole()
    if (!user) {
      throw redirect({
        to: '/',
      })
    }
    return { user }
  },
  loader: async () => {
    const users = await getAllUsers()
    return { users }
  },
  component: UsersPage,
})

function UsersPage() {
  const { users } = Route.useLoaderData()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  // Filter users based on search
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'host':
        return <UserCog className="w-4 h-4" />
      default:
        return <UserIcon className="w-4 h-4" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'host':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl">User Management</CardTitle>
            <Button variant="outline" onClick={() => navigate({ to: '/' })}>
              Back to Events
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Total users: {users.length}
          </p>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full px-4 py-2 border rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getRoleBadgeVariant(user.role)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                          {user.emailVerified ? 'Verified' : 'Not Verified'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
