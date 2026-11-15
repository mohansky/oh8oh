import type { D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types'

// Cloudflare Browser Rendering API types
export interface BrowserBinding extends Fetcher {
  fetch(request: Request): Promise<Response>
}

export interface CloudflareEnv {
  // D1 Database binding
  DB: D1Database

  // R2 Bucket for images
  R2: R2Bucket

  // Browser Rendering API for web scraping
  BROWSER: BrowserBinding

  // Environment variables
  ENVIRONMENT?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  SESSION_SECRET?: string

  // KV Namespace (if you add caching)
  // CACHE?: KVNamespace
}

// Augment the global namespace for server functions
declare global {
  interface RequestInit {
    cf?: any
  }
}

export {}
