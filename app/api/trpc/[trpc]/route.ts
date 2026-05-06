import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers'
import { supabaseAdmin } from '@/server/db'
import type { Context } from '@/server/trpc'

async function createContext(req: Request): Promise<Context> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { userId: null }
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return { userId: user?.id ?? null }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
  })

export { handler as GET, handler as POST }
