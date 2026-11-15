declare module 'better-auth' {
  interface Session {
    user: {
      id: string
      email: string
      emailVerified: boolean
      name: string
      createdAt: Date
      updatedAt: Date
      image?: string | null
      role: 'admin' | 'host' | 'user'
    }
  }
}

declare module 'better-auth/react' {
  interface Session {
    user: {
      id: string
      email: string
      emailVerified: boolean
      name: string
      createdAt: Date
      updatedAt: Date
      image?: string | null
      role: 'admin' | 'host' | 'user'
    }
  }
}
