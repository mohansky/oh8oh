/**
 * Nitro plugin — wires the daily full scrape to Cloudflare Cron Triggers.
 *
 * Nitro's `cloudflare-module` preset already exports a `scheduled()` Worker
 * handler that fires the `cloudflare:scheduled` hook (wrapped in
 * `ctx.waitUntil`) on every Cron Trigger invocation, and sets
 * `globalThis.__env__ = env` beforehand — so the normal `getEnv()`/scrape path
 * works unchanged here. The cron schedule itself lives in wrangler.toml
 * (`[triggers] crons`). This replaces the old public `GET /api/cron/scrape`
 * endpoint, so there is no unauthenticated trigger left to secure.
 *
 * Registered explicitly via `plugins` in nitro.config.ts.
 */

interface ScheduledPayload {
  controller: { cron?: string; scheduledTime?: number }
  env: any
  context: { waitUntil: (p: Promise<unknown>) => void }
}

export default function scheduledScrapePlugin(nitroApp: any) {
  nitroApp.hooks.hook(
    'cloudflare:scheduled',
    async ({ controller, env }: ScheduledPayload) => {
      const cron = controller?.cron ?? '(unknown)'
      console.log(`⏰ Cron Trigger fired (${cron}) — starting full scrape...`)

      try {
        const { forceRefreshEvents } = await import('../cache/events-cache')
        // Full scrape including Puppeteer/Browser Rendering sources.
        await forceRefreshEvents(false, env)
        console.log('✅ Scheduled full scrape completed')
      } catch (error) {
        console.error('❌ Scheduled full scrape failed:', error)
      }
    },
  )
}
