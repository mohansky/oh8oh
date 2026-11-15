import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { decodeAndValidateImage, isSafeHttpUrl } from '../utils/validation'
import {
  getCloudflareEnv,
  getSessionUser,
  headersFromCtx,
  requireRole,
} from './session'

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
    const user = await requireRole(headersFromCtx(ctx), ['admin', 'host'])
    const userId = user.id

    // Reject unsafe links (javascript:, data:, etc.) — they render as hrefs
    if (!isSafeHttpUrl(eventData.link)) {
      throw new Error('Event link must be a valid http(s) URL')
    }

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')

    // Upload image to R2 if provided
    let imageUrl = eventData.image || null

    if (eventData.imageData && eventData.imageFileName && eventData.imageType) {
      // Validate + decode with size/MIME enforcement (throws on invalid input)
      const { bytes, contentType, fileName } = decodeAndValidateImage(
        eventData.imageData,
        eventData.imageType,
      )
      try {
        // Get R2 binding from Cloudflare context
        const r2 = getCloudflareEnv(ctx)?.R2
        if (r2) {
          const { uploadImageToR2 } = await import('../r2-upload')
          imageUrl = await uploadImageToR2(r2, bytes, fileName, contentType)
        } else {
          console.warn('R2 binding not available, skipping image upload')
        }
      } catch (error) {
        // A transient R2 failure shouldn't block event creation
        console.error('Failed to upload image to R2:', error)
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
      // Only admins may feature events; hosts cannot self-promote
      featured: user.role === 'admin' ? eventData.featured || false : false,
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
}).handler(async (ctx: any): Promise<Array<UserEvent>> => {
  try {
    const user = await getSessionUser(headersFromCtx(ctx))
    if (!user || (user.role !== 'admin' && user.role !== 'host')) {
      return []
    }

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    // Get user's events
    const events = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, user.id))

    return events as Array<UserEvent>
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
    const user = await requireRole(headersFromCtx(ctx), ['admin', 'host'])
    const userId = user.id

    // Reject unsafe links (javascript:, data:, etc.) — they render as hrefs
    if (!isSafeHttpUrl(eventData.link)) {
      throw new Error('Event link must be a valid http(s) URL')
    }

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq, and } = await import('drizzle-orm')

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
      // Validate + decode with size/MIME enforcement (throws on invalid input)
      const { bytes, contentType, fileName } = decodeAndValidateImage(
        eventData.imageData,
        eventData.imageType,
      )
      try {
        // Get R2 binding from Cloudflare context
        const r2 = getCloudflareEnv(ctx)?.R2
        if (r2) {
          const { uploadImageToR2 } = await import('../r2-upload')
          imageUrl = await uploadImageToR2(r2, bytes, fileName, contentType)

          // TODO: Optionally delete old image from R2 if it exists
          // if (existingEvent[0].image) {
          //   await deleteImageFromR2(r2, existingEvent[0].image)
          // }
        } else {
          console.warn('R2 binding not available, skipping image upload')
        }
      } catch (error) {
        console.error('Failed to upload image to R2:', error)
        // Keep existing image on upload failure
        imageUrl = existingEvent[0].image
      }
    }

    // Only admins may change the featured flag; hosts keep the existing value
    const featured =
      user.role === 'admin'
        ? eventData.featured || false
        : existingEvent[0].featured

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
        featured,
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
    const user = await requireRole(headersFromCtx(ctx), ['admin', 'host'])
    const userId = user.id

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq, and } = await import('drizzle-orm')

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
}).handler(async (ctx: any): Promise<Array<UserEvent>> => {
  try {
    const user = await getSessionUser(headersFromCtx(ctx))
    if (!user || user.role !== 'admin') {
      return []
    }

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq, or } = await import('drizzle-orm')

    // Get all pending and rejected events for review
    const events = await db
      .select()
      .from(userEvents)
      .where(or(eq(userEvents.status, 'pending'), eq(userEvents.status, 'rejected')))

    return events as Array<UserEvent>
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
    await requireRole(headersFromCtx(ctx), ['admin'])

    const { db } = await import('../../db')
    const { userEvents, removedEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

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
    await requireRole(headersFromCtx(ctx), ['admin'])

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

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
    await requireRole(headersFromCtx(ctx), ['admin'])

    const { db } = await import('../../db')
    const { userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')

    // Delete the event (admin can delete any event)
    await db.delete(userEvents).where(eq(userEvents.id, eventId))

    return { success: true }
  } catch (error) {
    console.error('Failed to delete event:', error)
    throw error
  }
})

// Admin: Mark any event (scraped or user-submitted) as removed
export const markEventAsRemoved = createServerFn({
  method: 'POST',
}).handler(async (ctx: any): Promise<{ success: boolean }> => {
  const { event } = ctx.data as { event: any }

  try {
    const admin = await requireRole(headersFromCtx(ctx), ['admin'])
    const userId = admin.id

    const { db } = await import('../../db')
    const { removedEvents, userEvents } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { generateEventFingerprint, hashEventFingerprint } = await import(
      '../utils/event-fingerprint'
    )

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
