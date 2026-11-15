import { createAuthClient } from 'better-auth/react'
// import { passkeyClient } from '@better-auth/passkey/client'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3000',
  // plugins: [passkeyClient()],
})

export const { useSession, signIn, signOut, signUp } = authClient
