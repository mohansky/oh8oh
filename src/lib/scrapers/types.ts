// Common types for event scrapers

export interface Event {
  id?: string // For user-submitted events
  title: string
  date: string
  time: string
  link: string
  description?: string
  category?: string | string[] // Support both single and multiple categories
  image?: string
  venue?: string
  price?: string
  source: string // Which website the event is from
}

export interface ScraperResult {
  events: Event[]
  metadata?: {
    month?: string
    year?: string
    venue?: string
    totalCount?: number
  }
}

export interface EventScraper {
  // Unique identifier for the scraper
  id: string

  // Display name for the source
  name: string

  // Website URL
  website: string

  // Whether this scraper is enabled
  enabled: boolean

  // Priority level (high = run first, low = run last). Defaults to 'normal'
  priority?: 'high' | 'normal' | 'low'

  // Scrape function that returns events
  // env is the Cloudflare Workers env (provides BROWSER binding for JS-rendered pages)
  scrape: (env?: any) => Promise<ScraperResult>
}
