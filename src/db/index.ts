import { drizzle } from 'drizzle-orm/libsql/http'
import * as schema from './schema'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

function getEnv(key: string): string | undefined {
  // Check process.env first (works in Node/dev)
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]
  }
  // Fallback to globalThis.__env__ (Cloudflare Workers via Nitro)
  const env = (globalThis as any).__env__
  if (env?.[key]) {
    return env[key]
  }
  return undefined
}

let _db: LibSQLDatabase<typeof schema> | undefined

export function getDb() {
  if (!_db) {
    _db = drizzle({
      connection: {
        url: getEnv('TURSO_DATABASE_URL') || 'file:local.db',
        authToken: getEnv('TURSO_AUTH_TOKEN'),
      },
      schema,
    })
  }
  return _db
}

// Lazy proxy so existing `import { db }` usage works without changes
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as any)[prop]
  },
})

export { schema }
