// User role types and utilities
export const USER_ROLES = {
  ADMIN: 'admin',
  HOST: 'host',
  USER: 'user',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// Role descriptions
export const ROLE_DESCRIPTIONS = {
  admin: 'Full access to all features and settings',
  host: 'Can create and manage events',
  user: 'Can browse events and bookmark favorites',
} as const

// Role permissions helper functions
export const isAdmin = (role?: string): boolean => role === USER_ROLES.ADMIN
export const isHost = (role?: string): boolean => role === USER_ROLES.HOST || isAdmin(role)
export const isUser = (role?: string): boolean => !!role

// Get role display name
export const getRoleDisplayName = (role?: string): string => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'Admin'
    case USER_ROLES.HOST:
      return 'Event Host'
    case USER_ROLES.USER:
      return 'User'
    default:
      return 'User'
  }
}

// Get role badge color (for UI)
export const getRoleBadgeColor = (role?: string): string => {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    case USER_ROLES.HOST:
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    case USER_ROLES.USER:
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
}
