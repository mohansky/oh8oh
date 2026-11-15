import { createFileRoute } from '@tanstack/react-router'

// Pages anyone can open. Account, admin and API routes are left out (and
// disallowed in robots.txt).
const STATIC_PATHS = ['/', '/calendar', '/featured', '/sources', '/about', '/privacy']

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Use whatever host the request came in on, so the sitemap is right
        // on workers.dev today and on a custom domain later with no change.
        const origin = new URL(request.url).origin

        let eventPaths: Array<string> = []
        try {
          const { getUpcomingEvents } = await import('../lib/db/events-db')
          const { withApprovedAndWithoutRemoved } = await import(
            '../lib/server/visible-events'
          )
          const { generateEventFingerprint } = await import(
            '../lib/utils/event-fingerprint'
          )
          const events = await withApprovedAndWithoutRemoved(
            await getUpcomingEvents(),
          )
          eventPaths = [
            ...new Set(
              events.map(
                (event) =>
                  `/event/${encodeURIComponent(generateEventFingerprint(event))}`,
              ),
            ),
          ]
        } catch (error) {
          // Still serve the static pages if the database is unreachable.
          console.error('[sitemap] Failed to load events:', error)
        }

        const urls = [...STATIC_PATHS, ...eventPaths]
          .map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`)
          .join('\n')

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
