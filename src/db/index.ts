import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

// This will be injected by Cloudflare Workers at runtime
// For local development with wrangler, DB binding is available
export function getDB(env?: any) {
  if (env?.DB) {
    // Use Cloudflare D1 (both production and local dev with wrangler)
    return drizzle(env.DB, { schema })
  }

  throw new Error('Database binding not available. Make sure to run with `wrangler dev` or deploy to Cloudflare.')
}

// Export for direct access (will need env context)
export { schema }
export const db = { __needsEnv: true } as any
