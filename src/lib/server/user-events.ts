import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { uploadImageToR2 } from '../r2-upload'

interface CreateEventData {
  title: string
  date: string
  time: string
  link: string
  description?: string
  category?: string
  image?: string
  imageData?: string // base64 image data
  imageFileName?: string
  imageType?: string
  venue?: string
  price?: string
  featured?: boolean
}

interface UpdateEventData extends CreateEventData {
  id: string
}

interface UserEvent {
  id: string
  userId: string
  title: string
  date: string
  time: string
  link: string
  description: string | null
  category: string | null
  image: string | null
  venue: string | null
  price: string | null
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

// Create a new user event
export const createUserEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ id: string; status: string }> => {
  const eventData = ctx.data as CreateEventData

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    // Get user from session
    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin or host role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin' && user.role !== 'host') {
      throw new Error('Unauthorized: Only admins and hosts can create events')
    }

    // Upload image to R2 if provided
    let imageUrl = eventData.image || null

    if (eventData.imageData && eventData.imageFileName && eventData.imageType) {
      try {
        // Convert base64 to Buffer
        const base64Data = eventData.imageData.split(',')[1] // Remove data:image/xxx;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64')

        // Upload to R2
        imageUrl = await uploadImageToR2(buffer, eventData.imageFileName, eventData.imageType)
      } catch (error) {
        console.error('Failed to upload image to R2:', error)
        // Continue without image rather than failing the whole event creation
        imageUrl = null
      }
    }

    // Create the event
    const eventId = nanoid()
    const now = new Date()

    await db.insert(userEvents).values({
      id: eventId,
      userId,
      title: eventData.title,
      date: eventData.date,
      time: eventData.time,
      link: eventData.link,
      description: eventData.description || null,
      category: eventData.category || null,
      image: imageUrl,
      venue: eventData.venue || null,
      price: eventData.price || null,
      status: 'pending', // All events require admin review
      featured: eventData.featured || false,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id: eventId,
      status: 'pending',
    }
  } catch (error) {
    console.error('Failed to create user event:', error)
    throw error
  }
})

// Get all approved user events
export const getApprovedUserEvents = createServerFn({
  method: 'GET',
}).handler(async () => {
  try {
    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const events = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.status, 'approved'))

    // Convert to Event format
    return events.map((event) => ({
      title: event.title,
      date: event.date,
      time: event.time,
      link: event.link,
      description: event.description || '',
      category: event.category || '',
      image: event.image || '',
      venue: event.venue || '',
      price: event.price || '',
      source: 'user-submitted',
    }))
  } catch (error) {
    console.error('Failed to get approved user events:', error)
    return []
  }
})

// Get all featured events (approved and featured)
export const getFeaturedEvents = createServerFn({
  method: 'GET',
}).handler(async () => {
  try {
    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq, and } = await import('drizzle-orm')

    const events = await db
      .select()
      .from(userEvents)
      .where(
        and(
          eq(userEvents.status, 'approved'),
          eq(userEvents.featured, true)
        )
      )

    // Convert to Event format
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      link: event.link,
      description: event.description || '',
      category: event.category || '',
      image: event.image || '',
      venue: event.venue || '',
      price: event.price || '',
      source: 'user-submitted',
      featured: event.featured,
    }))
  } catch (error) {
    console.error('Failed to get featured events:', error)
    return []
  }
})

// Get current user's events
export const getMyEvents = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<UserEvent[]> => {
  try {
    const request = ctx.request
    if (!request || !request.headers) {
      return []
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      return []
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      return []
    }

    const userId = sessionData[0].userId

    // Verify user has admin or host role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      return []
    }

    const user = userData[0]
    if (user.role !== 'admin' && user.role !== 'host') {
      return []
    }

    // Get user's events
    const events = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, userId))

    return events as UserEvent[]
  } catch (error) {
    console.error('Failed to get user events:', error)
    return []
  }
})

// Update user event
export const updateUserEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const eventData = ctx.data as UpdateEventData

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq, and } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin or host role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin' && user.role !== 'host') {
      throw new Error('Unauthorized: Only admins and hosts can update events')
    }

    // Verify event belongs to user
    const existingEvent = await db
      .select()
      .from(userEvents)
      .where(and(eq(userEvents.id, eventData.id), eq(userEvents.userId, userId)))
      .limit(1)

    if (!existingEvent || existingEvent.length === 0) {
      throw new Error('Event not found or unauthorized')
    }

    // Upload new image to R2 if provided
    let imageUrl = eventData.image || existingEvent[0].image

    if (eventData.imageData && eventData.imageFileName && eventData.imageType) {
      try {
        // Convert base64 to Buffer
        const base64Data = eventData.imageData.split(',')[1] // Remove data:image/xxx;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64')

        // Upload to R2
        imageUrl = await uploadImageToR2(buffer, eventData.imageFileName, eventData.imageType)

        // TODO: Optionally delete old image from R2 if it exists
        // if (existingEvent[0].image) {
        //   await deleteImageFromR2(existingEvent[0].image)
        // }
      } catch (error) {
        console.error('Failed to upload image to R2:', error)
        // Keep existing image on upload failure
        imageUrl = existingEvent[0].image
      }
    }

    // Update the event
    await db
      .update(userEvents)
      .set({
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        link: eventData.link,
        description: eventData.description || null,
        category: eventData.category || null,
        image: imageUrl,
        venue: eventData.venue || null,
        price: eventData.price || null,
        featured: eventData.featured || false,
        updatedAt: new Date(),
      })
      .where(eq(userEvents.id, eventData.id))

    return { success: true }
  } catch (error) {
    console.error('Failed to update user event:', error)
    throw error
  }
})

// Delete user event
export const deleteUserEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { eventId } = ctx.data as { eventId: string }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq, and } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin or host role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin' && user.role !== 'host') {
      throw new Error('Unauthorized: Only admins and hosts can delete events')
    }

    // Verify event belongs to user
    const existingEvent = await db
      .select()
      .from(userEvents)
      .where(and(eq(userEvents.id, eventId), eq(userEvents.userId, userId)))
      .limit(1)

    if (!existingEvent || existingEvent.length === 0) {
      throw new Error('Event not found or unauthorized')
    }

    // Delete the event
    await db.delete(userEvents).where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to delete user event:', error)
    throw error
  }
})

// Admin: Get all pending events for review
export const getPendingEvents = createServerFn({
  method: 'GET',
}).handler(async (ctx: any): Promise<UserEvent[]> => {
  try {
    const request = ctx.request
    if (!request || !request.headers) {
      return []
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      return []
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq, or } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      return []
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      return []
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      return []
    }

    // Get all pending and rejected events for review
    const events = await db
      .select()
      .from(userEvents)
      .where(or(eq(userEvents.status, 'pending'), eq(userEvents.status, 'rejected')))

    return events as UserEvent[]
  } catch (error) {
    console.error('Failed to get pending events:', error)
    return []
  }
})

// Admin: Approve event
export const approveEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { eventId } = ctx.data as { eventId: string }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents, removedEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can approve events')
    }

    // Get event details to generate fingerprint
    const eventData = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.id, eventId))
      .limit(1)

    if (eventData.length > 0) {
      const event = eventData[0]
      const { generateEventFingerprint } = await import('../utils/event-fingerprint')

      // Generate fingerprint to remove from removedEvents table
      const fingerprint = generateEventFingerprint({
        title: event.title,
        date: event.date,
        link: event.link,
        time: event.time,
        venue: event.venue || '',
        source: 'user-submitted',
      })

      // Remove from removedEvents table so it shows up on main list
      await db
        .delete(removedEvents)
        .where(eq(removedEvents.eventFingerprint, fingerprint))
    }

    // Update event status to approved
    await db
      .update(userEvents)
      .set({
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to approve event:', error)
    throw error
  }
})

// Admin: Reject event
export const rejectEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { eventId } = ctx.data as { eventId: string }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can reject events')
    }

    // Update event status to rejected
    await db
      .update(userEvents)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to reject event:', error)
    throw error
  }
})

// Admin: Delete any event
export const adminDeleteEvent = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { eventId } = ctx.data as { eventId: string }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can delete any event')
    }

    // Delete the event (admin can delete any event)
    await db.delete(userEvents).where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to delete event:', error)
    throw error
  }
})

// Admin: Remove event from main list (unapprove)
export const removeEventFromList = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { eventId } = ctx.data as { eventId: string }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const { session: sessionTable, user: userTable, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can remove events from list')
    }

    // Update event status to pending (sends it back to review)
    await db
      .update(userEvents)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to remove event from list:', error)
    throw error
  }
})

// Admin: Mark any event (scraped or user-submitted) as removed
export const markEventAsRemoved = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { event } = ctx.data as { event: any }

  try {
    const request = ctx.request
    if (!request || !request.headers) {
      throw new Error('No request object in context')
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const sessionMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/)

    if (!sessionMatch) {
      throw new Error('User not authenticated')
    }

    // URL decode and extract unsigned token
    let sessionToken = decodeURIComponent(sessionMatch[1])
    if (sessionToken.includes('.')) {
      sessionToken = sessionToken.split('.')[0]
    }

    const { db } = await import('../../db')
    const {
      session: sessionTable,
      user: userTable,
      removedEvents,
      userEvents,
    } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { generateEventFingerprint, hashEventFingerprint } = await import(
      '../utils/event-fingerprint'
    )

    const sessionData = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, sessionToken))
      .limit(1)

    if (!sessionData || sessionData.length === 0) {
      throw new Error('Invalid session')
    }

    const userId = sessionData[0].userId

    // Verify user has admin role
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)

    if (!userData || userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    if (user.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can remove events')
    }

    // Generate fingerprint for the event
    const fingerprint = generateEventFingerprint(event)
    const fingerprintHash = await hashEventFingerprint(fingerprint)

    // Check if already removed
    const existing = await db
      .select()
      .from(removedEvents)
      .where(eq(removedEvents.eventFingerprint, fingerprint))
      .limit(1)

    if (existing.length > 0) {
      // Already removed, just return success
      return { success: true }
    }

    // If it's a user-submitted event, update its status to pending (for review)
    if (event.id && event.source === 'user-submitted') {
      await db
        .update(userEvents)
        .set({
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(userEvents.id, event.id))
    } else {
      // If it's a scraped event, create a new entry in userEvents for review
      const { nanoid } = await import('nanoid')
      const eventId = nanoid()

      await db.insert(userEvents).values({
        id: eventId,
        userId: userId, // Assign to the admin who removed it
        title: event.title,
        date: event.date,
        time: event.time || '',
        link: event.link,
        description: event.description || '',
        category: event.category ? (Array.isArray(event.category) ? JSON.stringify(event.category) : event.category) : '',
        image: event.image || '',
        venue: event.venue || '',
        price: event.price || '',
        status: 'pending', // Set to pending for review
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Add to removed events table to hide from main list
    await db.insert(removedEvents).values({
      id: fingerprintHash,
      eventFingerprint: fingerprint,
      removedBy: userId,
      removedAt: new Date(),
      title: event.title,
      date: event.date,
      link: event.link,
      source: event.source,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to mark event as removed:', error)
    throw error
  }
})

// Get all removed event fingerprints (for filtering)
export const getRemovedEventFingerprints = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string[]> => {
  try {
    const { db } = await import('../../db')
    const { removedEvents } = await import('../../db/schema')

    const removed = await db.select().from(removedEvents)

    return removed.map((r) => r.eventFingerprint)
  } catch (error) {
    console.error('Failed to get removed events:', error)
    return []
  }
})
