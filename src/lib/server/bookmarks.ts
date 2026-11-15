import { createServerFn } from '@tanstack/react-start'
import { addBookmark, getUserBookmarks, removeBookmark } from '../db/bookmarks-db'
import { getSessionUser, headersFromCtx, requireUser } from './session'
import type { Event } from '../scrapers/types'

// Server function to toggle bookmark
export const toggleBookmark = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ bookmarked: boolean }> => {
  const event = ctx.data as Event

  try {
    const user = await requireUser(headersFromCtx(ctx))
    const userId = user.id

    // Check if already bookmarked
    const bookmarks = await getUserBookmarks(userId)
    const isCurrentlyBookmarked = bookmarks.some((b) => b.link === event.link)

    if (isCurrentlyBookmarked) {
      await removeBookmark(userId, event)
      return { bookmarked: false }
    } else {
      await addBookmark(userId, event)
      return { bookmarked: true }
    }
  } catch (error) {
    console.error('Failed to toggle bookmark:', error)
    throw error
  }
})

// Server function to check which events are bookmarked
export const getBookmarkedEventLinks = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<Set<string>> => {
  try {
    const user = await getSessionUser(headersFromCtx(ctx))
    if (!user) {
      return new Set()
    }

    const bookmarks = await getUserBookmarks(user.id)
    return new Set(bookmarks.map((b) => b.link))
  } catch (error) {
    console.error('Failed to get bookmarked events:', error)
    return new Set()
  }
})
