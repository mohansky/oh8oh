import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
// import { passkey } from '@better-auth/passkey'
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { db } from '../db'
import * as schema from '../db/schema'
import { ResetPasswordEmail } from './emails/reset-password'
import { VerifyEmail } from './emails/verify-email'

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]
  }
  const env = (globalThis as any).__env__
  if (env?.[key]) {
    return env[key]
  }
  return undefined
}

let _auth: ReturnType<typeof betterAuth> | undefined

function createAuth() {
  const resend = new Resend(getEnv('RESEND_API_KEY'))
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        // passkey: schema.passkey,
      },
    }),

    // User configuration with custom fields
    user: {
      deleteUser: {
        enabled: true,
      },
      additionalFields: {
        role: {
          type: 'string',
          required: true,
          defaultValue: 'user',
          input: false,
          returned: true,
        },
        timeFormat: {
          type: 'string',
          required: true,
          defaultValue: '12h',
          input: true,
          returned: true,
        },
      },
    },

    // Email & Password Authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }: { user: { name: string; email: string }; url: string }) => {
        console.log('[auth] Sending reset password email to:', user.email)
        const html = await render(ResetPasswordEmail({ name: user.name, url }))
        const result = await resend.emails.send({
          from: getEnv('RESEND_FROM_EMAIL') || 'oh8oh <mail@mohankumar.dev>',
          to: user.email,
          subject: 'Reset your password - oh8oh',
          html,
        })
        console.log('[auth] Reset email result:', JSON.stringify(result))
      },
    },

    // Email verification
    emailVerification: {
      sendVerificationEmail: async ({ user, url }: { user: { name: string; email: string }; url: string }) => {
        console.log('[auth] Sending verification email to:', user.email)
        const html = await render(VerifyEmail({ name: user.name, url }))
        const result = await resend.emails.send({
          from: getEnv('RESEND_FROM_EMAIL') || 'oh8oh <mail@mohankumar.dev>',
          to: user.email,
          subject: 'Verify your email - oh8oh',
          html,
        })
        console.log('[auth] Verification email result:', JSON.stringify(result))
      },
    },

    // Social Providers (revisit later)
    // socialProviders: {
    //   google: {
    //     clientId: getEnv('GOOGLE_CLIENT_ID') || '',
    //     clientSecret: getEnv('GOOGLE_CLIENT_SECRET') || '',
    //     enabled: !!getEnv('GOOGLE_CLIENT_ID') && !!getEnv('GOOGLE_CLIENT_SECRET'),
    //   },
    // },

    // Passkey Plugin (revisit later)
    // plugins: [
    //   passkey({
    //     rpName: 'oh8oh - Bangalore Events',
    //     rpID: getEnv('PASSKEY_RP_ID') || 'localhost',
    //     origin: getEnv('PASSKEY_ORIGIN') || 'http://localhost:3000',
    //   }),
    // ],

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    // Base URL for redirects
    baseURL: getEnv('BETTER_AUTH_URL') || 'http://localhost:3000',

    // Trust proxy headers. Only trust localhost in non-production so a page on
    // localhost can't make trusted cross-origin auth requests against prod.
    trustedOrigins: [
      getEnv('BETTER_AUTH_URL') || 'http://localhost:3000',
      ...(getEnv('NODE_ENV') === 'production' ? [] : ['http://localhost:3000']),
    ],
  })
}

// Lazy proxy so existing `import { auth }` usage works without changes
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop) {
    if (!_auth) _auth = createAuth()
    return (_auth)[prop]
  },
})
