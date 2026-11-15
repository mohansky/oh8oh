import {
  Home,
  Heart,
  User,
  Plus,
  Calendar,
  CheckCircle,
  Users,
  Star,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'host' | 'user'

export interface MenuItem {
  label: string
  path: string
  icon: LucideIcon
  roles: UserRole[] // Empty array means accessible to all authenticated users
}

// Menu items configuration
export const menuItems: MenuItem[] = [
  {
    label: 'Events',
    path: '/',
    icon: Home,
    roles: [], // All authenticated users
  },
  {
    label: 'Featured',
    path: '/featured',
    icon: Star,
    roles: [], // All authenticated users
  },
  {
    label: 'Add Event',
    path: '/add-event',
    icon: Plus,
    roles: ['admin', 'host'],
  },
  {
    label: 'My Events',
    path: '/my-events',
    icon: Calendar,
    roles: ['admin', 'host'],
  },
  {
    label: 'Review Events',
    path: '/admin/review-events',
    icon: CheckCircle,
    roles: ['admin'],
  },
  {
    label: 'Manage Users',
    path: '/admin/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    label: 'Bookmarks',
    path: '/bookmarks',
    icon: Heart,
    roles: [], // All authenticated users
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: User,
    roles: [], // All authenticated users
  },
]

/**
 * Filter menu items based on user role
 */
export function getMenuItemsForRole(userRole: UserRole): MenuItem[] {
  return menuItems.filter((item) => {
    // If no roles specified, show to all authenticated users
    if (item.roles.length === 0) return true
    // Otherwise, check if user's role is in the allowed roles
    return item.roles.includes(userRole)
  })
}
