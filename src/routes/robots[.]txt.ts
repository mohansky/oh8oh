import { createFileRoute } from '@tanstack/react-router'

// Served from a route rather than a static file so the Sitemap line can
// carry the host the request came in on (it must be an absolute URL).
const PRIVATE_PATHS = [
  '/api/',
  '/admin/',
  '/auth',
  '/reset-password',
  '/profile',
  '/bookmarks',
  '/my-events',
  '/add-event',
  '/offline',
]

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin
        const body = [
          'User-agent: *',
          ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
          '',
          `Sitemap: ${origin}/sitemap.xml`,
          '',
        ].join('\n')

        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
