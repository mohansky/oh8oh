import type { R2Bucket } from '@cloudflare/workers-types'

export interface CloudflareEnv {
  // R2 Bucket for images
  R2: R2Bucket

  // Browser Rendering API for web scraping
  BROWSER: unknown

  // Environment variables
  ENVIRONMENT?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  SESSION_SECRET?: string
}

export {}
