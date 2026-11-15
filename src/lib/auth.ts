import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { passkey } from '@better-auth/passkey'
import { db } from '../db'
import * as schema from '../db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      passkey: schema.passkey,
    },
  }),

  // User configuration with custom fields
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false, // Don't allow users to set this directly
        returned: true, // Ensure this is returned in session
      },
      timeFormat: {
        type: 'string',
        required: true,
        defaultValue: '12h',
        input: false, // Don't allow users to set this directly during registration
        returned: true, // Ensure this is returned in session
      },
    },
  },

  // Email & Password Authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production with email service
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Social Providers (Uncomment when ready to use)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    },
    // Add more providers as needed:
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID || '',
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    // },
  },

  // Passkey Plugin (WebAuthn)
  plugins: [
    passkey({
      rpName: 'Evre - Bangalore Events',
      rpID: process.env.PASSKEY_RP_ID || 'localhost',
      origin: process.env.PASSKEY_ORIGIN || 'http://localhost:3000',
    }),
  ],

  // Advanced session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Base URL for redirects
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // Trust proxy headers (useful for deployment)
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    'http://localhost:3000',
  ],
})
