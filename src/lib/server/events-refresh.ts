import { createServerFn } from '@tanstack/react-start'

// Server function to force refresh events
export const refreshEvents = createServerFn({
  method: 'POST',
}).handler(async () => {
  try {
    console.log('🔄 Manual refresh initiated (fast mode)...')
    const { forceRefreshEvents } = await import('../cache/events-cache')

    // Manual refresh uses fast mode (only BIC, MAP, IHA, IME)
    // This ensures completion in ~20-30 seconds without timeout
    // Background auto-refresh (every 30 min) will use all scrapers
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Refresh timeout after 60 seconds')), 60000)
    })

    await Promise.race([
      forceRefreshEvents(true), // fastOnly: true for manual refresh
      timeoutPromise
    ])

    console.log('✅ Force refresh completed')
    return { success: true }
  } catch (error) {
    console.error('❌ Force refresh error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    // Return error instead of throwing to prevent client-side crash
    return {
      success: false,
      error: errorMessage
    }
  }
})
