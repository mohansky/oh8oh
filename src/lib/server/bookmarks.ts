import { createServerFn } from '@tanstack/react-start'
import { addBookmark, removeBookmark, getUserBookmarks } from '../db/bookmarks-db'
import type { Event } from '../scrapers/types'

// Server function to toggle bookmark
export const toggleBookmark = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ bookmarked: boolean }> => {
  const event = ctx.data as Event

  try {
    // Get request from handler context
    const request = ctx.request

    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    // Get cookie header
    const cookieHeader = request.headers.get('cookie') || ''

    // Parse session from cookie (better-auth stores session in cookie)
    // The cookie name is "better-auth.session_token" (with hyphen, not underscore)
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated - no session cookie')
    }

    // URL decode the session token (cookies may have %3D instead of =)
    let sessionToken = decodeURIComponent(sessionMatch[1])

    // Better-auth uses signed tokens: cookie has "token.signature" but DB stores just "token"
    // Extract the unsigned token part (before the dot)
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    // Query the database for the session
    const { db } = await import('../../db')
    const { session: sessionTable } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('User not authenticated - invalid session')
    }

    const userId = sessionData[0].userId

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
    const request = ctx.request

    if (!request || !request.headers) {
      return new Set()
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      return new Set()
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      return new Set()
    }

    const userId = sessionData[0].userId
    const bookmarks = await getUserBookmarks(userId)
    return new Set(bookmarks.map((b) => b.link))
  } catch (error) {
    console.error('Failed to get bookmarked events:', error)
    return new Set()
  }
})
