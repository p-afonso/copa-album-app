export const dynamic = 'force-dynamic'

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { TRPCError } from '@trpc/server'
import { appRouter } from '@/server/routers'
import { supabaseAdmin } from '@/server/db'
import type { Context } from '@/server/trpc'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

async function createContext(req: Request): Promise<Context> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { userId: null }
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  const userId = user?.id ?? null

  // 120 API calls per minute per authenticated user (or 30/min for unauthenticated IPs)
  const key = userId ? `trpc:user:${userId}` : `trpc:ip:${getClientIp(req)}`
  const [limit, windowMs] = userId ? [120, 60_000] : [30, 60_000]
  if (!checkRateLimit(key, limit, windowMs)) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' })
  }

  return { userId }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  })

export { handler as GET, handler as POST }
