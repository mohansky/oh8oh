/**
 * Site-wide constants.
 *
 * SITE_URL is the public origin, used wherever a link has to be absolute
 * (share images, for example — social sites won't resolve a relative one).
 * It is inlined at build time: set VITE_SITE_URL to override, otherwise the
 * auth URL is used, since both are simply "where the site lives".
 */
export const SITE_NAME = 'oh8oh'

export const SITE_DESCRIPTION =
  'Discover and explore upcoming events in Bangalore. Your go-to event aggregator for concerts, workshops, exhibitions, and more.'

export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  import.meta.env.VITE_AUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '')

/** 1200×630 image shown when a page is shared and has no image of its own. */
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og-image.png`

export const CONTACT_EMAIL = 'contact@oh8oh.com'
