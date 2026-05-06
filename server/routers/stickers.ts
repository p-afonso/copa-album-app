import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

const StatusEnum = z.enum(['missing', 'obtained', 'repeated'])

async function assertMember(albumId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('album_members')
    .select('user_id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })
}

export const stickersRouter = router({
  list: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('sticker_id, status, quantity, updated_at')
        .eq('album_id', input.albumId)

      if (error) throw new Error(error.message)

      const statusMap = new Map(
        (data ?? []).map((r) => [r.sticker_id, { status: r.status, quantity: r.quantity }]),
      )

      return ALL_STICKERS.map((s) => {
        const entry = statusMap.get(s.id)
        return {
          ...s,
          status: (entry?.status ?? 'missing') as 'missing' | 'obtained' | 'repeated',
          quantity: entry?.quantity ?? 0,
        }
      })
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        albumId: z.string().uuid(),
        stickerId: z.string(),
        status: StatusEnum,
        quantity: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      if (input.status === 'missing') {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .delete()
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing', quantity: 0 }
      }

      const quantity = input.status === 'repeated' ? (input.quantity ?? 2) : 1

      const { error } = await supabaseAdmin
        .from('album_stickers')
        .upsert(
          {
            album_id: input.albumId,
            sticker_id: input.stickerId,
            status: input.status,
            quantity,
            updated_by: ctx.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'album_id,sticker_id' },
        )
      if (error) throw new Error(error.message)
      return { status: input.status, quantity }
    }),

  getProgress: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const total = ALL_STICKERS.length

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('status, quantity')
        .eq('album_id', input.albumId)

      if (error) throw new Error(error.message)

      const obtained = (data ?? []).filter((r) => r.status === 'obtained').length
      const repeated = (data ?? []).filter((r) => r.status === 'repeated').length
      const missing = total - obtained - repeated
      const duplicateCount = (data ?? [])
        .filter((r) => r.status === 'repeated')
        .reduce((sum, r) => sum + (r.quantity - 1), 0)

      return { total, obtained, repeated, missing, duplicateCount }
    }),

  listDuplicates: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('sticker_id, quantity')
        .eq('album_id', input.albumId)
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

  decrementRepeated: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), stickerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error: fetchError } = await supabaseAdmin
        .from('album_stickers')
        .select('quantity')
        .eq('album_id', input.albumId)
        .eq('sticker_id', input.stickerId)
        .maybeSingle()

      if (fetchError) throw new Error(fetchError.message)
      if (!data) throw new Error('Figurinha não encontrada')

      const qty = data.quantity

      if (qty <= 1) {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .delete()
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing' as const, quantity: 0 }
      }

      if (qty === 2) {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .update({ status: 'obtained', quantity: 1, updated_at: new Date().toISOString(), updated_by: ctx.userId })
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'obtained' as const, quantity: 1 }
      }

      const { error } = await supabaseAdmin
        .from('album_stickers')
        .update({ quantity: qty - 1, updated_at: new Date().toISOString(), updated_by: ctx.userId })
        .eq('album_id', input.albumId)
        .eq('sticker_id', input.stickerId)
      if (error) throw new Error(error.message)
      return { status: 'repeated' as const, quantity: qty - 1 }
    }),
})
