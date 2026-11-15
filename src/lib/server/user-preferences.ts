/**
 * Server functions for user preferences
 */

import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db'
import { user } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '../auth'

/**
 * Update user's time format preference
 */
export const updateTimeFormat = createServerFn({ method: 'POST' }).handler(
  async (ctx: any): Promise<{ success: boolean; timeFormat: '12h' | '24h' }> => {
    const { timeFormat } = ctx.data as { timeFormat: '12h' | '24h' }

    try {
      const request = ctx.request
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        throw new Error('Not authenticated')
      }

      await db
        .update(user)
        .set({
          timeFormat: timeFormat,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id))

      return { success: true, timeFormat }
    } catch (error) {
      console.error('Failed to update time format:', error)
      throw error
    }
  }
)
