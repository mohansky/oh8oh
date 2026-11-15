import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  role: text('role', { enum: ['admin', 'host', 'user'] }).notNull().default('user'),
  timeFormat: text('timeFormat', { enum: ['12h', '24h'] }).notNull().default('12h'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', {
    mode: 'timestamp',
  }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
})

// Passkey table for WebAuthn credentials
export const passkey = sqliteTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('publicKey').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  webauthnUserID: text('webauthnUserID'),
  counter: integer('counter').notNull(),
  deviceType: text('deviceType').notNull(),
  backedUp: integer('backedUp', { mode: 'boolean' }).notNull(),
  transports: text('transports'),
  credentialID: text('credentialID').notNull().unique(),
  aaguid: text('aaguid').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
})

// Events table for storing scraped events
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), // Generated from title + date + source
  title: text('title').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  link: text('link').notNull(),
  description: text('description'),
  category: text('category'),
  image: text('image'),
  venue: text('venue'),
  price: text('price'),
  source: text('source').notNull(), // Which scraper this came from
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  scrapedAt: integer('scrapedAt', { mode: 'timestamp' }).notNull(), // When this was last scraped
})

// Scraper run history table for tracking scraping jobs
export const scraperRuns = sqliteTable('scraper_runs', {
  id: text('id').primaryKey(),
  startedAt: integer('startedAt', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completedAt', { mode: 'timestamp' }),
  totalScrapers: integer('totalScrapers').notNull(),
  successCount: integer('successCount').notNull(),
  errorCount: integer('errorCount').notNull(),
  originalEventCount: integer('originalEventCount').notNull(),
  deduplicatedEventCount: integer('deduplicatedEventCount').notNull(),
  errors: text('errors'), // JSON stringified errors
})

// Bookmarks table for users to save events
export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Store event details directly since scraped events may change/disappear
  eventTitle: text('eventTitle').notNull(),
  eventDate: text('eventDate').notNull(),
  eventTime: text('eventTime').notNull(),
  eventLink: text('eventLink').notNull(),
  eventDescription: text('eventDescription'),
  eventCategory: text('eventCategory'),
  eventImage: text('eventImage'),
  eventVenue: text('eventVenue'),
  eventPrice: text('eventPrice'),
  eventSource: text('eventSource').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
})

// User-submitted events table for events created by hosts/admins
export const userEvents = sqliteTable('user_events', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  link: text('link').notNull(),
  description: text('description'),
  category: text('category'),
  image: text('image'), // R2 URL
  venue: text('venue'),
  price: text('price'),
  status: text('status', {
    enum: ['draft', 'pending', 'approved', 'rejected'],
  })
    .notNull()
    .default('pending'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
})

// Removed events table for tracking events removed by admins (both scraped and user-submitted)
export const removedEvents = sqliteTable('removed_events', {
  id: text('id').primaryKey(), // SHA-256 hash of title + date + link
  eventFingerprint: text('eventFingerprint').notNull().unique(), // Composite key for identifying events
  removedBy: text('removedBy')
    .notNull()
    .references(() => user.id),
  removedAt: integer('removedAt', { mode: 'timestamp' }).notNull(),
  // Store event details for reference
  title: text('title').notNull(),
  date: text('date').notNull(),
  link: text('link').notNull(),
  source: text('source').notNull(),
})
