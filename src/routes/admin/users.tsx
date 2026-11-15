import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Shield, UserCog, User as UserIcon } from 'lucide-react'
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
    const { getSessionUser, headersFromCtx } = await import('../../lib/server/session')
    const user = await getSessionUser(headersFromCtx(ctx))

    // Check if user has admin role
    if (user && user.role === 'admin') {
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
}).handler(async (ctx: any): Promise<Array<User>> => {
  try {
    const { getSessionUser, headersFromCtx } = await import('../../lib/server/session')
    const currentUser = await getSessionUser(headersFromCtx(ctx))

    // Verify user is admin
    if (!currentUser || currentUser.role !== 'admin') {
      return []
    }

    const { db } = await import('../../db')
    const { user: userTable } = await import('../../db/schema')

    // Get all users
    const allUsers = await db.select().from(userTable)

    return allUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
