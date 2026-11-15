import { desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { bookmarks } from '../../db/schema'
import type { Event } from '../scrapers/types'

/**
 * Create a unique bookmark ID from userId and event details
 */
function generateBookmarkId(userId: string, event: Event): string {
  // Use event link as unique identifier (most stable across scrapes)
  return `${userId}_${Buffer.from(event.link).toString('base64').slice(0, 32)}`
}

/**
 * Add an event to user's bookmarks
 */
export async function addBookmark(userId: string, event: Event) {
  const bookmarkId = generateBookmarkId(userId, event)

  const result = await db
    .insert(bookmarks)
    .values({
      id: bookmarkId,
      userId,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventLink: event.link,
      eventDescription: event.description || null,
      eventCategory: event.category
        ? Array.isArray(event.category)
          ? JSON.stringify(event.category)
          : event.category
        : null,
      eventImage: event.image || null,
      eventVenue: event.venue || null,
      eventPrice: event.price || null,
      eventSource: event.source,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning()

  return result[0]
}

/**
 * Remove an event from user's bookmarks
 */
export async function removeBookmark(userId: string, event: Event) {
  const bookmarkId = generateBookmarkId(userId, event)

  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId))

  return { success: true }
}

/**
 * Check if an event is bookmarked by the user
 */
export async function isBookmarked(userId: string, event: Event): Promise<boolean> {
  const bookmarkId = generateBookmarkId(userId, event)

  const result = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, bookmarkId))
    .limit(1)

  return result.length > 0
}

/**
 * Get all bookmarks for a user
 */
export async function getUserBookmarks(userId: string): Promise<Array<Event>> {
  const userBookmarks = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))

  // Convert bookmarks back to Event format
  return userBookmarks.map((bookmark) => ({
    title: bookmark.eventTitle,
    date: bookmark.eventDate,
    time: bookmark.eventTime,
    link: bookmark.eventLink,
    description: bookmark.eventDescription || undefined,
    category: bookmark.eventCategory || undefined,
    image: bookmark.eventImage || undefined,
    venue: bookmark.eventVenue || undefined,
    price: bookmark.eventPrice || undefined,
    source: bookmark.eventSource,
  }))
}

/**
 * Get bookmark IDs for a user (for quick lookup)
 */
export async function getUserBookmarkIds(userId: string): Promise<Set<string>> {
  const userBookmarks = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))

  return new Set(userBookmarks.map((b) => b.id))
}
