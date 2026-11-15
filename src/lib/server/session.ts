/**
 * Shared server-side session/authorization helpers.
 *
 * All server functions must resolve the current user through these helpers
 * rather than parsing the session cookie by hand. Better Auth's
 * `auth.api.getSession` verifies the cookie's HMAC signature (signed with
 * BETTER_AUTH_SECRET) and the session's expiry — both of which the previous
 * hand-rolled `token.split('.')[0]` + raw DB lookup skipped entirely.
 */

import { auth } from '../auth'
import type { UserRole } from '../roles'

export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: UserRole
  timeFormat?: '12h' | '24h'
  image?: string | null
}

/**
 * Resolve the authenticated user from the request headers, or null if the
 * request carries no valid (signed, unexpired) session. Never throws.
 */
export async function getSessionUser(
  headers?: Headers | null,
): Promise<AuthUser | null> {
  if (!headers) return null
  try {
    const result = await auth.api.getSession({ headers })
    if (!result?.user) return null
    return result.user as AuthUser
  } catch (error) {
    console.error('[session] getSession failed:', error)
    return null
  }
}

/**
 * Resolve the authenticated user or throw. Use in mutations where an
 * unauthenticated caller is an error rather than an empty result.
 */
export async function requireUser(headers?: Headers | null): Promise<AuthUser> {
  const user = await getSessionUser(headers)
  if (!user) {
    throw new Error('Unauthorized: authentication required')
  }
  return user
}

/**
 * Resolve the authenticated user and assert they hold one of `roles`,
 * throwing otherwise.
 */
export async function requireRole(
  headers: Headers | null | undefined,
  roles: Array<UserRole>,
): Promise<AuthUser> {
  const user = await requireUser(headers)
  if (!roles.includes(user.role)) {
    throw new Error('Unauthorized: insufficient permissions')
  }
  return user
}

/**
 * Extract the request `Headers` from a server-function handler context.
 * Returns null if the context has no usable request (keeps read paths graceful).
 */
export function headersFromCtx(ctx: any): Headers | null {
  const request = ctx?.request
  if (!request || !request.headers) return null
  return request.headers as Headers
}

/**
 * Resolve the Cloudflare `waitUntil` from a handler context, if available.
 *
 * Workers cancel pending promises once the response is returned, so any
 * fire-and-forget background work (e.g. the events cache's non-blocking
 * scrape) must be registered via `waitUntil` to survive. Probes the known
 * locations the ExecutionContext can appear in and returns undefined outside
 * Workers (e.g. dev), where floating promises run to completion anyway.
 */
export function getWaitUntil(
  ctx: any,
): ((p: Promise<unknown>) => void) | undefined {
  const cf = ctx?.context?.cloudflare
  // Nitro's cloudflare-module preset decorates the incoming Request itself
  // (`req.waitUntil`, `req.runtime.cloudflare = { env, context }`) and
  // TanStack Start hands that same Request to server functions as
  // `ctx.request` — the server-fn `context` object is middleware context and
  // carries no Cloudflare bindings, so the request is the reliable source.
  const request = ctx?.request
  const candidates = [
    request,
    request?.runtime?.cloudflare?.context,
    cf?.ctx,
    cf?.context,
    cf?.executionContext,
    ctx?.context?.executionContext,
    typeof globalThis !== 'undefined' ? (globalThis as any) : undefined,
  ]
  for (const c of candidates) {
    if (c && typeof c.waitUntil === 'function') {
      return (p: Promise<unknown>) => {
        try {
          c.waitUntil(p)
        } catch {
          /* ignore — falls back to floating promise */
        }
      }
    }
  }
  return undefined
}

/**
 * Resolve the Cloudflare env (bindings such as `R2`/`BROWSER`, plus vars and
 * secrets) for a server-function handler.
 *
 * Nitro sets `globalThis.__env__` on every request and also attaches the env
 * to the Request (`req.runtime.cloudflare.env`). The server-fn `context` does
 * NOT carry it, so `ctx.context.cloudflare.env` alone is always undefined in
 * production. Returns undefined outside Workers (plain `pnpm dev`).
 */
export function getCloudflareEnv(ctx?: any): any {
  return (
    ctx?.request?.runtime?.cloudflare?.env ??
    ctx?.context?.cloudflare?.env ??
    (globalThis as any).__env__
  )
}
