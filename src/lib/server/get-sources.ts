import { createServerFn } from '@tanstack/react-start'

interface SourceInfo {
  id: string
  name: string
  website: string
  enabled: boolean
}

export const getSources = createServerFn({
  method: 'GET',
}).handler(async (): Promise<Array<SourceInfo>> => {
  const { scrapers } = await import('../scrapers')

  return scrapers.map((scraper) => ({
    id: scraper.id,
    name: scraper.name,
    website: scraper.website,
    enabled: scraper.enabled,
  }))
})
