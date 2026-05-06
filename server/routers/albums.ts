import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

type AlbumRow = { id: string; name: string; type: string; invite_code: string | null }

export const albumsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data: memberships, error } = await supabaseAdmin
      .from('album_members')
      .select('album_id, role, albums(id, name, type, invite_code)')
      .eq('user_id', ctx.userId)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const total = ALL_STICKERS.length

    const albums = await Promise.all(
      (memberships ?? []).map(async (m) => {
        const album = m.albums as unknown as AlbumRow

        const { count: memberCount } = await supabaseAdmin
          .from('album_members')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', album.id)

        const { data: stickers } = await supabaseAdmin
          .from('album_stickers')
          .select('status')
          .eq('album_id', album.id)

        const obtained = (stickers ?? []).filter((s) => s.status === 'obtained').length

        return {
          id: album.id,
          name: album.name,
          type: album.type as 'personal' | 'shared',
          role: m.role as 'owner' | 'member',
          inviteCode: album.invite_code,
          memberCount: memberCount ?? 0,
          progress: { obtained, total },
        }
      }),
    )

    return albums
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50), type: z.enum(['personal', 'shared']) }))
    .mutation(async ({ ctx, input }) => {
      const invite_code = input.type === 'shared' ? generateInviteCode() : null

      const { data: album, error } = await supabaseAdmin
        .from('albums')
        .insert({ name: input.name, type: input.type, owner_id: ctx.userId, invite_code })
        .select('id')
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      const { error: memberError } = await supabaseAdmin
        .from('album_members')
        .insert({ album_id: album.id, user_id: ctx.userId, role: 'owner' })

      if (memberError)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: memberError.message })

      return { albumId: album.id }
    }),

  join: protectedProcedure
    .input(z.object({ inviteCode: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const { data: album, error } = await supabaseAdmin
        .from('albums')
        .select('id')
        .eq('invite_code', input.inviteCode.toUpperCase())
        .maybeSingle()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      if (!album) throw new TRPCError({ code: 'NOT_FOUND', message: 'Código inválido' })

      const { data: existing } = await supabaseAdmin
        .from('album_members')
        .select('user_id')
        .eq('album_id', album.id)
        .eq('user_id', ctx.userId)
        .maybeSingle()

      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Você já é membro deste álbum' })

      const { error: insertError } = await supabaseAdmin
        .from('album_members')
        .insert({ album_id: album.id, user_id: ctx.userId, role: 'member' })

      if (insertError)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: insertError.message })

      return { albumId: album.id }
    }),

  rename: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('albums')
        .update({ name: input.name })
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  regenerateCode: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const newCode = generateInviteCode()

      const { error } = await supabaseAdmin
        .from('albums')
        .update({ invite_code: newCode })
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)
        .eq('type', 'shared')

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { inviteCode: newCode }
    }),

  getMembers: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('album_members')
        .select('user_id')
        .eq('album_id', input.albumId)
        .eq('user_id', ctx.userId)
        .maybeSingle()

      if (!membership)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })

      const { data: members, error } = await supabaseAdmin
        .from('album_members')
        .select('user_id, role')
        .eq('album_id', input.albumId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      const membersWithUsername = await Promise.all(
        (members ?? []).map(async (m) => {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('user_id', m.user_id)
            .maybeSingle()
          return {
            userId: m.user_id,
            username: profile?.username ?? 'desconhecido',
            role: m.role as 'owner' | 'member',
          }
        }),
      )

      return membersWithUsername
    }),

  removeMember: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.userId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não pode remover a si mesmo' })

      const { data: album } = await supabaseAdmin
        .from('albums')
        .select('owner_id')
        .eq('id', input.albumId)
        .maybeSingle()

      if (!album || album.owner_id !== ctx.userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o dono pode remover membros' })

      const { error } = await supabaseAdmin
        .from('album_members')
        .delete()
        .eq('album_id', input.albumId)
        .eq('user_id', input.targetUserId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  leave: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: album } = await supabaseAdmin
        .from('albums')
        .select('owner_id')
        .eq('id', input.albumId)
        .maybeSingle()

      if (album?.owner_id === ctx.userId)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dono não pode sair. Delete o álbum ou transfira a propriedade.',
        })

      const { error } = await supabaseAdmin
        .from('album_members')
        .delete()
        .eq('album_id', input.albumId)
        .eq('user_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  delete: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('albums')
        .delete()
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),
})
