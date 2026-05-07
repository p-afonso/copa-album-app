import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

const usernameSchema = z.string().regex(
  /^[a-zA-Z0-9_]{3,20}$/,
  'Username inválido: 3–20 caracteres, letras, números e _',
)

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('user_id', ctx.userId)
      .maybeSingle()
    return data ? { username: data.username } : null
  }),

  checkUsername: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(input.username)) {
        return { available: false }
      }
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .ilike('username', input.username)
        .maybeSingle()
      return { available: data === null }
    }),

  create: protectedProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: ctx.userId, username: input.username })
      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Username já existe' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }
      return { username: input.username }
    }),

  updateUsername: protectedProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      const { data: conflict } = await supabaseAdmin
        .from('profiles').select('user_id')
        .ilike('username', input.username).neq('user_id', ctx.userId).maybeSingle()
      if (conflict)
        throw new TRPCError({ code: 'CONFLICT', message: 'Username já existe' })
      const { error } = await supabaseAdmin
        .from('profiles').update({ username: input.username }).eq('user_id', ctx.userId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { username: input.username }
    }),

  getTradeHistory: protectedProcedure.query(async ({ ctx }) => {
    const { data: proposals, error } = await supabaseAdmin
      .from('trade_proposals').select('*')
      .or(`proposer_id.eq.${ctx.userId},receiver_id.eq.${ctx.userId}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (!proposals?.length) return []

    const otherUserIds = [...new Set(
      proposals.map(p => p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id),
    )]
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('user_id, username').in('user_id', otherUserIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.username]))
    const stickerMap = new Map(ALL_STICKERS.map(s => [s.id, s.countryName]))

    return proposals.map(p => {
      const isProposer = p.proposer_id === ctx.userId
      return {
        id: p.id as string,
        gave: {
          id: (isProposer ? p.offered_sticker : p.wanted_sticker) as string,
          countryName: stickerMap.get(isProposer ? p.offered_sticker : p.wanted_sticker) ?? '',
        },
        received: {
          id: (isProposer ? p.wanted_sticker : p.offered_sticker) as string,
          countryName: stickerMap.get(isProposer ? p.wanted_sticker : p.offered_sticker) ?? '',
        },
        otherUsername: profileMap.get(isProposer ? p.receiver_id : p.proposer_id) ?? '?',
        date: p.updated_at as string,
      }
    })
  }),
})
