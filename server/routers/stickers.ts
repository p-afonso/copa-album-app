import { z } from 'zod'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

const StatusEnum = z.enum(['missing', 'obtained', 'repeated'])

export const stickersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabaseAdmin
      .from('user_stickers')
      .select('sticker_id, status, quantity, updated_at')
      .eq('user_id', ctx.userId)

    if (error) throw new Error(error.message)

    const statusMap = new Map(
      (data ?? []).map((r) => [r.sticker_id, { status: r.status, quantity: r.quantity }]),
    )

    return ALL_STICKERS.map((s) => {
      const user = statusMap.get(s.id)
      return {
        ...s,
        status: (user?.status ?? 'missing') as 'missing' | 'obtained' | 'repeated',
        quantity: user?.quantity ?? 0,
      }
    })
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        stickerId: z.string(),
        status: StatusEnum,
        quantity: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === 'missing') {
        const { error } = await supabaseAdmin
          .from('user_stickers')
          .delete()
          .eq('user_id', ctx.userId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing', quantity: 0 }
      }

      const quantity = input.status === 'repeated' ? (input.quantity ?? 2) : 1

      const { error } = await supabaseAdmin
        .from('user_stickers')
        .upsert(
          {
            user_id: ctx.userId,
            sticker_id: input.stickerId,
            status: input.status,
            quantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,sticker_id' },
        )
      if (error) throw new Error(error.message)
      return { status: input.status, quantity }
    }),

  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const total = ALL_STICKERS.length

    const { data, error } = await supabaseAdmin
      .from('user_stickers')
      .select('status, quantity')
      .eq('user_id', ctx.userId)

    if (error) throw new Error(error.message)

    const obtained = (data ?? []).filter((r) => r.status === 'obtained').length
    const repeated = (data ?? []).filter((r) => r.status === 'repeated').length
    const missing = total - obtained - repeated
    const duplicateCount = (data ?? [])
      .filter((r) => r.status === 'repeated')
      .reduce((sum, r) => sum + (r.quantity - 1), 0)

    return { total, obtained, repeated, missing, duplicateCount }
  }),

  listDuplicates: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabaseAdmin
      .from('user_stickers')
      .select('sticker_id, quantity')
      .eq('user_id', ctx.userId)
      .eq('status', 'repeated')
      .order('sticker_id')

    if (error) throw new Error(error.message)

    const idSet = new Set((data ?? []).map((r) => r.sticker_id))
    const stickers = ALL_STICKERS.filter((s) => idSet.has(s.id))
    const qtyMap = new Map((data ?? []).map((r) => [r.sticker_id, r.quantity]))

    return stickers.map((s) => ({
      ...s,
      quantity: qtyMap.get(s.id) ?? 1,
      extras: (qtyMap.get(s.id) ?? 1) - 1,
    }))
  }),
})
