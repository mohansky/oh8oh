import { createServerFn } from '@tanstack/react-start'
import { getCloudflareEnv, headersFromCtx, requireRole } from './session'

// Server function to force refresh events (fast mode - no browser scrapers)
export const refreshEvents = createServerFn({
  method: 'POST',
}).handler(async (ctx: any) => {
  try {
    // Scraping is expensive (billable Turso/Browser Rendering usage) — admins only
    await requireRole(headersFromCtx(ctx), ['admin'])

    console.log('🔄 Manual refresh initiated (fast mode)...')
    const { forceRefreshEvents } = await import('../cache/events-cache')
    const env = getCloudflareEnv(ctx)

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Refresh timeout after 60 seconds')), 60000)
    })

    await Promise.race([
      forceRefreshEvents(true, env),
      timeoutPromise
    ])

    console.log('✅ Force refresh completed')
    return { success: true }
  } catch (error) {
    console.error('❌ Force refresh error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
})

// Server function for full refresh (includes browser scrapers - Cloudflare only)
export const refreshAllEvents = createServerFn({
  method: 'POST',
}).handler(async (ctx: any) => {
  try {
    // Full scrape (Puppeteer + Browser Rendering) is the most expensive path — admins only
    await requireRole(headersFromCtx(ctx), ['admin'])

    console.log('🔄 Full refresh initiated (all scrapers including browser)...')
    const { forceRefreshEvents } = await import('../cache/events-cache')
    const env = getCloudflareEnv(ctx)

    if (!env?.BROWSER) {
      console.warn('⚠️ No BROWSER binding available - browser scrapers will be skipped')
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Full refresh timeout after 5 minutes')), 300000)
    })

    await Promise.race([
      forceRefreshEvents(false, env),
      timeoutPromise
    ])

    console.log('✅ Full refresh completed')
    return { success: true }
  } catch (error) {
    console.error('❌ Full refresh error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
})
